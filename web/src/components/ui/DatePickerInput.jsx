import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar-rac";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDate } from "@internationalized/date";

/**
 * Formats a CalendarDate → "28 May 2026" style
 */
function formatDisplayDate(date) {
  if (!date) return "";
  const jsDate = new Date(date.year, date.month - 1, date.day);
  return jsDate.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Robust date parser supporting multiple formats (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, standard string)
 */
function parseTypedDate(str) {
  if (!str) return null;
  
  // Try default Date parsing
  let parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  // Try common formats: DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1; // 0-indexed
    const year = parseInt(dmyMatch[3], 10);
    parsed = new Date(year, month, day);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  // Try YYYY-MM-DD
  const ymdMatch = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (ymdMatch) {
    const year = parseInt(ymdMatch[1], 10);
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    parsed = new Date(year, month, day);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

/**
 * DatePickerInput — replaces the native browser date input with a high-end date picker.
 */
export function DatePickerInput({
  value,
  onChange,
  label,
  placeholder = "Select date",
  required = false,
  style,
  className,
  id,
}) {
  const [open, setOpen] = React.useState(false);
  const blurTimeoutRef = React.useRef(null);

  // The selected date as a CalendarDate object (derived from YYYY-MM-DD prop)
  const selectedDate = React.useMemo(() => {
    if (!value) return undefined;
    const [y, m, d] = value.split("-").map(Number);
    if (!y || !m || !d) return undefined;
    return new CalendarDate(y, m, d);
  }, [value]);

  // The display string in the text input ("28 May 2026")
  const [inputText, setInputText] = React.useState(() => formatDisplayDate(selectedDate));

  // Sync display text when selectedDate changes externally
  React.useEffect(() => {
    setInputText(formatDisplayDate(selectedDate));
  }, [selectedDate]);

  // Clear timeout on unmount
  React.useEffect(() => {
    return () => {
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
      }
    };
  }, []);

  function handleCalendarSelect(date) {
    // Clear any pending blur timeout so it doesn't revert state
    if (blurTimeoutRef.current) {
      clearTimeout(blurTimeoutRef.current);
    }
    
    if (!date) {
      onChange("");
      setInputText("");
      // Defer close so the current click finishes on the calendar (prevents the
      // click falling through to whatever element is beneath the popover).
      setTimeout(() => setOpen(false), 0);
      return;
    }

    const y = date.year;
    const m = String(date.month).padStart(2, "0");
    const d = String(date.day).padStart(2, "0");
    const ymdString = `${y}-${m}-${d}`;

    onChange(ymdString);
    setInputText(formatDisplayDate(date));
    // Defer close so the current click finishes on the calendar (prevents the
    // click falling through to whatever element is beneath the popover).
    setTimeout(() => setOpen(false), 0);
  }

  function handleInputChange(e) {
    setInputText(e.target.value);
  }

  function handleBlur(e) {
    const raw = e.target.value.trim();
    e.target.style.borderColor = "#E5E7EB";
    
    // Delay blur processing so calendar selection clicks can register first
    blurTimeoutRef.current = setTimeout(() => {
      if (!raw) {
        onChange("");
        setInputText("");
        return;
      }
      
      const parsed = parseTypedDate(raw);
      if (parsed) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, "0");
        const d = String(parsed.getDate()).padStart(2, "0");
        const ymdString = `${y}-${m}-${d}`;
        
        onChange(ymdString);
        setInputText(formatDisplayDate(new CalendarDate(y, parsed.getMonth() + 1, parsed.getDate())));
      } else {
        // Revert display text back to the formatted version of selectedDate
        setInputText(formatDisplayDate(selectedDate));
      }
    }, 180);
  }

  return (
    <div style={style} className={className}>
      {label && (
        <label
          htmlFor={id}
          style={{
            display: "block",
            fontSize: 11,
            fontWeight: 600,
            color: "#374151",
            marginBottom: 5,
            letterSpacing: "0.01em",
          }}
        >
          {label}
          {required && <span style={{ color: "#E11D2C", marginLeft: 3 }}>*</span>}
        </label>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <div style={{ position: "relative", display: "flex", cursor: "pointer" }}>
            <input
              id={id}
              type="text"
              value={inputText}
              placeholder={placeholder}
              onChange={handleInputChange}
              onBlur={handleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleBlur(e);
                  setOpen(false);
                } else if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setOpen(true);
                }
              }}
              style={{
                width: "100%",
                height: 38,
                padding: "0 36px 0 12px",
                borderRadius: 12,
                border: "1.5px solid #E5E7EB",
                background: "#FAFAFA",
                fontSize: 13,
                fontWeight: 500,
                color: "#0A0A0A",
                fontFamily: "inherit",
                transition: "border-color 0.15s",
                cursor: "pointer",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#E11D2C")}
            />

            {/* Calendar icon trigger visual */}
            <div
              style={{
                position: "absolute",
                right: 12,
                top: "50%",
                transform: "translateY(-50%)",
                color: "#9CA3AF",
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CalendarIcon size={15} />
            </div>
          </div>
        </PopoverTrigger>
        <PopoverContent
          className="modus-premium-popover w-auto overflow-hidden"
          align="start"
          sideOffset={6}
        >
          <Calendar
            value={selectedDate}
            onChange={handleCalendarSelect}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default DatePickerInput;
