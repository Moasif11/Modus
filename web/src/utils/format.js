// Formatting utilities

export const CURRENCY_SYMBOLS = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  AED: "د.إ",
  JPY: "¥",
  CNY: "¥",
  CAD: "$",
  AUD: "$",
  NZD: "$",
  SGD: "$",
  HKD: "$",
  RUB: "₽",
  ZAR: "R",
  BRL: "R$",
  MXN: "$",
  PLN: "zł",
  TRY: "₺",
  SAR: "ر.س",
  QAR: "ر.ق",
  KWD: "د.ك",
  OMR: "ر.ع.",
  BHD: "د.ب",
  THB: "฿",
  MYR: "RM",
  IDR: "Rp",
  PHP: "₱",
  VND: "₫",
  KRW: "₩",
};

export const CURRENCIES = [
  // Core currencies (at the top, per requests)
  { code: "USD", name: "US Dollar (USD)", symbol: "$" },
  { code: "AED", name: "UAE Dirham (AED)", symbol: "د.إ" },
  { code: "INR", name: "Indian Rupee (INR)", symbol: "₹" },
  // Other currencies
  { code: "EUR", name: "Euro (EUR)", symbol: "€" },
  { code: "GBP", name: "British Pound (GBP)", symbol: "£" },
  { code: "JPY", name: "Japanese Yen (JPY)", symbol: "¥" },
  { code: "CNY", name: "Chinese Yuan (CNY)", symbol: "¥" },
  { code: "CAD", name: "Canadian Dollar (CAD)", symbol: "$" },
  { code: "AUD", name: "Australian Dollar (AUD)", symbol: "$" },
  { code: "NZD", name: "New Zealand Dollar (NZD)", symbol: "$" },
  { code: "SGD", name: "Singapore Dollar (SGD)", symbol: "$" },
  { code: "HKD", name: "Hong Kong Dollar (HKD)", symbol: "$" },
  { code: "CHF", name: "Swiss Franc (CHF)", symbol: "Fr." },
  { code: "SEK", name: "Swedish Krona (SEK)", symbol: "kr" },
  { code: "NOK", name: "Norwegian Krone (NOK)", symbol: "kr" },
  { code: "DKK", name: "Danish Krone (DKK)", symbol: "kr" },
  { code: "RUB", name: "Russian Ruble (RUB)", symbol: "₽" },
  { code: "ZAR", name: "South African Rand (ZAR)", symbol: "R" },
  { code: "BRL", name: "Brazilian Real (BRL)", symbol: "R$" },
  { code: "MXN", name: "Mexican Peso (MXN)", symbol: "$" },
  { code: "PLN", name: "Polish Zloty (PLN)", symbol: "zł" },
  { code: "TRY", name: "Turkish Lira (TRY)", symbol: "₺" },
  { code: "SAR", name: "Saudi Riyal (SAR)", symbol: "ر.س" },
  { code: "QAR", name: "Qatari Riyal (QAR)", symbol: "ر.ق" },
  { code: "KWD", name: "Kuwaiti Dinar (KWD)", symbol: "د.ك" },
  { code: "OMR", name: "Omani Rial (OMR)", symbol: "ر.ع." },
  { code: "BHD", name: "Bahraini Dinar (BHD)", symbol: "د.ب" },
  { code: "THB", name: "Thai Baht (THB)", symbol: "฿" },
  { code: "MYR", name: "Malaysian Ringgit (MYR)", symbol: "RM" },
  { code: "IDR", name: "Indonesian Rupiah (IDR)", symbol: "Rp" },
  { code: "PHP", name: "Philippine Peso (PHP)", symbol: "₱" },
  { code: "VND", name: "Vietnamese Dong (VND)", symbol: "₫" },
  { code: "KRW", name: "South Korean Won (KRW)", symbol: "₩" },
];

// Format money in custom or Indian format dynamically
export function formatMoney(amount, currency = "INR") {
  const cleanCurrency = String(currency || "INR").toUpperCase();
  const hasSymbol = Object.prototype.hasOwnProperty.call(CURRENCY_SYMBOLS, cleanCurrency);
  const symbol = hasSymbol ? CURRENCY_SYMBOLS[cleanCurrency] : cleanCurrency;
  const spacing = hasSymbol ? "" : " ";

  if (amount === null || amount === undefined) return `${symbol}${spacing}0.00`;

  const num = parseFloat(amount);
  if (isNaN(num)) return `${symbol}${spacing}0.00`;

  const formatted = num.toFixed(2);
  const [intPart, decPart] = formatted.split(".");

  let formattedInt;
  if (cleanCurrency === "INR") {
    // Indian number system: last 3 digits, then groups of 2
    const lastThree = intPart.slice(-3);
    const otherDigits = intPart.slice(0, -3);
    formattedInt =
      otherDigits.replace(/\B(?=(\d{2})+(?!\d))/g, ",") +
      (otherDigits ? "," : "") +
      lastThree;
  } else {
    // Standard thousands separator (three digits grouping)
    formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  return `${symbol}${spacing}${formattedInt}.${decPart}`;
}

// Format date (YYYY-MM-DD -> DD MMM YYYY)
export function formatDate(dateStr) {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}


// Format amount in compact Indian notation (₹..Cr / ₹..L / ₹..k)
export function formatINRk(amount) {
  const n = parseFloat(amount) || 0;
  if (n >= 1e7) return "₹" + (n / 1e7).toFixed(2).replace(/\.00$/, "") + " Cr";
  if (n >= 1e5) return "₹" + (n / 1e5).toFixed(2).replace(/\.00$/, "") + " L";
  if (n >= 1e3) return "₹" + (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return "₹" + n.toFixed(2);
}

// Format amount in compact USD notation ($..M / $..k)
export function formatUSDk(amount) {
  const n = parseFloat(amount) || 0;
  if (n >= 1e6) return "$" + (n / 1e6).toFixed(2).replace(/\.00$/, "") + "M";
  if (n >= 1e3) return "$" + (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return "$" + n.toFixed(2);
}
