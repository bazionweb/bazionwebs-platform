export function formatAdmissionDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    const cleanDateStr = dateStr.includes(" ") ? dateStr.split(" ")[0] : dateStr;
    const date = new Date(cleanDateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = date.getDate();
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const month = months[date.getMonth()];
    const year = date.getFullYear();
    
    let suffix = "TH";
    if (day === 1 || day === 21 || day === 31) suffix = "ST";
    else if (day === 2 || day === 22) suffix = "ND";
    else if (day === 3 || day === 23) suffix = "RD";
    
    return `${day}${suffix} ${month} ${year}`;
  } catch { 
    return dateStr;
  }
}

export function formatSimpleDate(dateStr: string) {
  if (!dateStr) return "";
  try {
    const cleanDateStr = dateStr.includes(" ") ? dateStr.split(" ")[0] : dateStr;
    const date = new Date(cleanDateStr);
    if (isNaN(date.getTime())) return dateStr;
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  } catch { 
    return dateStr;
  }
}