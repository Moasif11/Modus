import React from "react";
import {
  Grid as ReiconGrid,
  Document as ReiconDocument,
  ReceiptText as ReiconReceiptText,
  Wallet as ReiconWallet,
  Users as ReiconUsers,
  Truck as ReiconTruck,
  UserCheck as ReiconUserCheck,
  Folder as ReiconFolder,
  ChartBarTrendUp as ReiconChart,
  Settings as ReiconSettings,
  Plus as ReiconPlus,
  Search as ReiconSearch,
  Bell as ReiconBell,
  Calendar as ReiconCalendar,
  ChevronRight as ReiconChevronRight,
  ChevronLeft as ReiconChevronLeft,
  ChevronDown as ReiconChevronDown,
  ArrowLeft as ReiconArrowLeft,
  ArrowRight as ReiconArrowRight,
  Check as ReiconCheck,
  X as ReiconX,
  MoreH as ReiconMoreH,
  Filter as ReiconFilter,
  Download as ReiconDownload,
  Copy as ReiconCopy,
  Printer as ReiconPrinter,
  Send as ReiconSend,
  Logout as ReiconLogout,
  TrendUp as ReiconTrendUp,
  TrendDown as ReiconTrendDown,
  ShieldCheck as ReiconShieldCheck,
  Clock as ReiconClock,
  Location as ReiconLocation,
  Sms as ReiconSms,
  Phone as ReiconPhone,
  Building as ReiconBuilding,
  Briefcase as ReiconBriefcase,
  Eye as ReiconEye,
  Edit as ReiconEdit,
  Lock as ReiconLock,
  Sparkles as ReiconSparkles,
  Box as ReiconBox,
  Palette as ReiconPalette,
  Upload as ReiconUpload,
  Bank as ReiconBank,
  ShieldAlert as ReiconShieldAlert,
  Sun as ReiconSun,
  Moon as ReiconMoon,
  Menu as ReiconMenu,
} from "reicon-react";

import {
  IndianRupee,
  ReceiptIndianRupee,
  Coins,
  PiggyBank,
  HandCoins,
  Sigma,
  Crown,
  Wrench,
  UserRound,
  CircleDollarSign,
  CircleAlert,
  CalendarClock,
  Layers,
  ArrowUpRight,
  CircleCheck,
  Hourglass,
  DollarSign,
  Package,
} from "lucide-react";

const REICON_MAP = {
  // Navigation & Core ERP Modules
  grid:           ReiconGrid,
  layoutGrid:     ReiconGrid,
  file:           ReiconDocument,
  document:       ReiconDocument,
  receipt:        ReiconReceiptText,
  receiptText:    ReiconReceiptText,
  wallet:         ReiconWallet,
  users:          ReiconUsers,
  truck:          ReiconTruck,
  userCheck:      ReiconUserCheck,
  folder:         ReiconFolder,
  chart:          ReiconChart,
  settings:       ReiconSettings,

  // UI Actions & Forms
  plus:           ReiconPlus,
  add:            ReiconPlus,
  search:         ReiconSearch,
  bell:           ReiconBell,
  calendar:       ReiconCalendar,
  chevronRight:   ReiconChevronRight,
  chevronLeft:    ReiconChevronLeft,
  chevronDown:    ReiconChevronDown,
  arrowLeft:      ReiconArrowLeft,
  arrowRight:     ReiconArrowRight,
  check:          ReiconCheck,
  x:              ReiconX,
  close:          ReiconX,
  more:           ReiconMoreH,
  filter:         ReiconFilter,
  download:       ReiconDownload,
  copy:           ReiconCopy,
  printer:        ReiconPrinter,
  send:           ReiconSend,
  logout:         ReiconLogout,

  // Trends & Status
  trendUp:        ReiconTrendUp,
  trendingUp:     ReiconTrendUp,
  "trending-up":  ReiconTrendUp,
  trendDown:      ReiconTrendDown,
  trendingDown:   ReiconTrendDown,
  "trending-down": ReiconTrendDown,
  shieldCheck:    ReiconShieldCheck,
  clock:          ReiconClock,
  alert:          ReiconShieldAlert,

  // Metadata & Profile
  mapPin:         ReiconLocation,
  location:       ReiconLocation,
  mail:           ReiconSms,
  sms:            ReiconSms,
  phone:          ReiconPhone,
  call:           ReiconPhone,
  building:       ReiconBuilding,
  briefcase:      ReiconBriefcase,
  eye:            ReiconEye,
  edit:           ReiconEdit,
  lock:           ReiconLock,
  sparkle:        ReiconSparkles,
  box:            ReiconBox,
  palette:        ReiconPalette,
  upload:         ReiconUpload,
  bank:           ReiconBank,
  landmark:       ReiconBank,
  banknote:       ReiconBank,
  sun:            ReiconSun,
  moon:           ReiconMoon,
  menu:           ReiconMenu,

  // Indian Statutory Currency & Specialized Math
  rupee:          IndianRupee,
  receiptRupee:   ReceiptIndianRupee,
  coins:          Coins,
  piggyBank:      PiggyBank,
  handCoins:      HandCoins,
  sigma:          Sigma,
  crown:          Crown,
  wrench:         Wrench,
  userRound:      UserRound,
  circleDollar:   CircleDollarSign,
  circleAlert:    CircleAlert,
  calendarClock:  CalendarClock,
  layers:         Layers,
  arrowUpRight:   ArrowUpRight,
  circleCheck:    CircleCheck,
  hourglass:      Hourglass,
  dollar:         DollarSign,
  package:        Package,
};

/**
 * Enterprise Icon Dispatcher
 * Powered by Reicon (https://reicon.dev) with Indian statutory currency support.
 */
export function Icon({
  name,
  size = 18,
  strokeWidth = 1.8,
  color = "currentColor",
  weight = "Outline",
  className = "",
  style,
  ...props
}) {
  const Component = REICON_MAP[name];
  if (!Component) return null;

  return (
    <Component
      size={size}
      strokeWidth={strokeWidth}
      color={color}
      weight={weight}
      className={className}
      style={{ flexShrink: 0, display: "inline-block", verticalAlign: "middle", ...style }}
      {...props}
    />
  );
}

export default Icon;
