import { cn } from "@/lib/utils";
import { getLocalTimeZone, today } from "@internationalized/date";
import {
  Button,
  CalendarCell as CalendarCellRac,
  CalendarGridBody as CalendarGridBodyRac,
  CalendarGridHeader as CalendarGridHeaderRac,
  CalendarGrid as CalendarGridRac,
  CalendarHeaderCell as CalendarHeaderCellRac,
  Calendar as CalendarRac,
  Heading as HeadingRac,
  RangeCalendar as RangeCalendarRac,
  composeRenderProps,
} from "react-aria-components";
import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";

const CalendarHeader = () => (
  <header className="modus-calendar-header">
    <HeadingRac className="modus-calendar-heading" />
    <div className="modus-calendar-nav">
      <Button
        slot="previous"
        className="modus-nav-btn modus-prev-btn"
      >
        <ChevronLeftIcon width={16} height={16} />
      </Button>
      <Button
        slot="next"
        className="modus-nav-btn modus-next-btn"
      >
        <ChevronRightIcon width={16} height={16} />
      </Button>
    </div>
  </header>
);

const CalendarGridComponent = ({ isRange = false }) => {
  const now = today(getLocalTimeZone());

  return (
    <CalendarGridRac>
      <CalendarGridHeaderRac>
        {(day) => (
          <CalendarHeaderCellRac className="react-aria-CalendarHeaderCell">
            {day}
          </CalendarHeaderCellRac>
        )}
      </CalendarGridHeaderRac>
      <CalendarGridBodyRac className="[&_td]:px-0">
        {(date) => (
          <CalendarCellRac
            date={date}
            className={cn(
              "react-aria-CalendarCell",
              date.compare(now) === 0 && "is-today"
            )}
          />
        )}
      </CalendarGridBodyRac>
    </CalendarGridRac>
  );
};

const CalendarStyles = () => (
  <style>{`
    /* Popover card override */
    .modus-premium-popover {
      background: #FFFFFF !important;
      border: 1px solid rgba(0, 0, 0, 0.08) !important;
      border-radius: 12px !important;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05) !important;
      padding: 0 !important; /* Let the calendar container control padding */
      overflow: hidden !important;
      z-index: 2000 !important; /* Must be above modals which use 1000 */
    }


    /* Calendar Container */
    .modus-calendar-container {
      display: flex !important;
      flex-direction: column !important;
      background: #FFFFFF !important;
      color: #1F2937 !important;
      font-family: 'Inter', sans-serif !important;
      user-select: none !important;
      padding: 16px !important;
      width: 270px !important;
      box-sizing: border-box !important;
    }

    /* Calendar Header */
    .modus-calendar-header {
      display: flex !important;
      align-items: center !important;
      justify-content: space-between !important;
      width: 100% !important;
      margin-bottom: 12px !important;
    }

    .modus-calendar-heading {
      font-size: 14px !important;
      font-weight: 600 !important;
      color: #111827 !important;
      margin: 0 !important;
      padding: 0 !important;
    }

    .modus-calendar-nav {
      display: flex !important;
      gap: 4px !important;
    }

    .modus-nav-btn {
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      width: 26px !important;
      height: 26px !important;
      border-radius: 6px !important;
      background: transparent !important;
      border: 1px solid #E5E7EB !important;
      color: #4B5563 !important;
      cursor: pointer !important;
      transition: all 0.15s ease !important;
      padding: 0 !important;
    }

    .modus-nav-btn:hover {
      background: #F3F4F6 !important;
      color: #111827 !important;
      border-color: #D1D5DB !important;
    }

    .modus-nav-btn:focus {
      outline: 2px solid #E11D2C !important;
      outline-offset: 1px !important;
    }

    /* Calendar Grid */
    .react-aria-CalendarGrid {
      width: 100% !important;
      border-collapse: separate !important;
      border-spacing: 0 4px !important; /* Elegant vertical row spacing */
      table-layout: fixed !important;
      margin: 0 !important;
      padding: 0 !important;
      border: none !important;
      display: table !important;
    }

    .react-aria-CalendarGrid tr {
      display: table-row !important;
      border: none !important;
    }

    /* Weekday Headers (M T W T F S S) */
    .react-aria-CalendarHeaderCell {
      width: 34px !important;
      height: 32px !important;
      padding: 0 !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      color: #6B7280 !important;
      text-align: center !important;
      vertical-align: middle !important;
      display: table-cell !important;
      border: none !important;
    }

    /* Calendar Date Cells */
    .react-aria-CalendarCell {
      width: 34px !important;
      height: 34px !important;
      padding: 0 !important;
      font-size: 13px !important;
      font-weight: 500 !important;
      color: #374151 !important;
      text-align: center !important;
      vertical-align: middle !important;
      border-radius: 8px !important;
      cursor: pointer !important;
      transition: all 0.12s ease !important;
      position: relative !important;
      display: table-cell !important;
      border: 1px solid transparent !important;
      box-sizing: border-box !important;
    }

    /* Hover State */
    .react-aria-CalendarCell[data-hovered="true"] {
      background: #F3F4F6 !important;
      color: #111827 !important;
    }

    /* Today Cell */
    .react-aria-CalendarCell.is-today {
      border: 1.5px solid #E11D2C !important;
      color: #E11D2C !important;
      font-weight: 600 !important;
    }

    /* Selected Cell */
    .react-aria-CalendarCell[data-selected="true"] {
      background: #E11D2C !important;
      color: #FFFFFF !important;
      font-weight: 600 !important;
      box-shadow: 0 4px 12px rgba(225, 29, 44, 0.2) !important;
      border-color: transparent !important;
    }

    /* Selected Hover */
    .react-aria-CalendarCell[data-selected="true"][data-hovered="true"] {
      background: #C11824 !important;
    }

    /* Outside Month Cells */
    .react-aria-CalendarCell[data-outside-month="true"] {
      color: #D1D5DB !important;
    }

    /* Action Buttons Footer */
    .modus-calendar-actions {
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      padding-top: 12px !important;
      border-top: 1px solid #F3F4F6 !important;
      margin-top: 10px !important;
    }

    .modus-action-btn {
      font-size: 12px !important;
      font-weight: 600 !important;
      background: transparent !important;
      border: none !important;
      cursor: pointer !important;
      padding: 6px 12px !important;
      border-radius: 6px !important;
      transition: all 0.15s !important;
      font-family: 'Inter', sans-serif !important;
    }

    .modus-clear-btn {
      color: #6B7280 !important;
    }

    .modus-clear-btn:hover {
      background: #F3F4F6 !important;
      color: #111827 !important;
    }

    .modus-today-btn {
      color: #E11D2C !important;
      background: #FEF2F2 !important;
    }

    .modus-today-btn:hover {
      background: #FEE2E2 !important;
      color: #B91C1C !important;
    }
  `}</style>
);

const Calendar = ({ className, value, onChange, ...props }) => {
  const handleToday = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const now = today(getLocalTimeZone());
    if (onChange) {
      onChange(now);
    }
  };

  const handleClear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onChange) {
      onChange(undefined);
    }
  };

  return (
    <div className="modus-calendar-container">
      <CalendarStyles />
      <CalendarRac
        value={value}
        onChange={onChange}
        {...props}
        className={composeRenderProps(className, (className) =>
          cn("w-fit", className)
        )}
      >
        <CalendarHeader />
        <CalendarGridComponent />
      </CalendarRac>
      
      {/* Action buttons at the bottom */}
      <div className="modus-calendar-actions">
        <button
          type="button"
          className="modus-action-btn modus-clear-btn"
          onClick={handleClear}
          onMouseDown={(e) => e.preventDefault()} /* Prevents steal of focus */
        >
          Clear
        </button>
        <button
          type="button"
          className="modus-action-btn modus-today-btn"
          onClick={handleToday}
          onMouseDown={(e) => e.preventDefault()} /* Prevents steal of focus */
        >
          Today
        </button>
      </div>
    </div>
  );
};

const RangeCalendar = ({ className, ...props }) => {
  return (
    <>
      <CalendarStyles />
      <RangeCalendarRac
        {...props}
        className={composeRenderProps(className, (className) =>
          cn("w-fit", className)
        )}
      >
        <CalendarHeader />
        <CalendarGridComponent isRange />
      </RangeCalendarRac>
    </>
  );
};

export { Calendar, RangeCalendar };
