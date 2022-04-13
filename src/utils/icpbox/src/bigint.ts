import JsonBigInt from "json-bigint";

// eslint-disable-next-line
export const recursiveParseBigint = (obj) =>
  obj ? JsonBigInt.parse(JsonBigInt.stringify(obj)) : undefined;
