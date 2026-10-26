// Convert numbers to Indian words (Rupees and Paise)

const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
];
const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];
const teens = [
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

function convertBelowHundred(num) {
  if (num < 10) return ones[num];
  if (num < 20) return teens[num - 10];
  const ten = Math.floor(num / 10);
  const one = num % 10;
  return tens[ten] + (one ? " " + ones[one] : "");
}

function convertBelowThousand(num) {
  if (num === 0) return "";
  if (num < 100) return convertBelowHundred(num);

  const hundred = Math.floor(num / 100);
  const remainder = num % 100;

  let result = ones[hundred] + " Hundred";
  if (remainder > 0) {
    result += " " + convertBelowHundred(remainder);
  }
  return result;
}

export function numberToWords(num) {
  if (num === 0) return "Zero Rupees Only";

  // Handle negative numbers
  if (num < 0) return "Negative " + numberToWords(Math.abs(num));

  // Split into rupees and paise
  const parts = num.toFixed(2).split(".");
  const rupees = parseInt(parts[0]);
  const paise = parseInt(parts[1]);

  if (rupees === 0) {
    if (paise === 0) return "Zero Rupees Only";
    return numberToWordsPaise(paise) + " Paise Only";
  }

  let result = "";

  // Crores (10,000,000)
  if (rupees >= 10000000) {
    const crores = Math.floor(rupees / 10000000);
    result += convertBelowThousand(crores) + " Crore ";
  }

  // Lakhs (100,000)
  const remainingAfterCrores = rupees % 10000000;
  if (remainingAfterCrores >= 100000) {
    const lakhs = Math.floor(remainingAfterCrores / 100000);
    result += convertBelowHundred(lakhs) + " Lakh ";
  }

  // Thousands (1,000)
  const remainingAfterLakhs = remainingAfterCrores % 100000;
  if (remainingAfterLakhs >= 1000) {
    const thousands = Math.floor(remainingAfterLakhs / 1000);
    result += convertBelowHundred(thousands) + " Thousand ";
  }

  // Hundreds, tens, ones
  const remainingAfterThousands = remainingAfterLakhs % 1000;
  if (remainingAfterThousands > 0) {
    result += convertBelowThousand(remainingAfterThousands) + " ";
  }

  result = result.trim() + " Rupees";

  // Add paise if present
  if (paise > 0) {
    result += " and " + numberToWordsPaise(paise) + " Paise";
  }

  return result + " Only";
}

function numberToWordsPaise(num) {
  if (num === 0) return "Zero";
  return convertBelowHundred(num);
}
