export function format(...data: any[]) {
  data.unshift(`[${new Date().toISOString()}]:`);
  return data.join(" ");
}
