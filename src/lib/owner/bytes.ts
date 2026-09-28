const MIB = BigInt(1024) * BigInt(1024);

export function mibToBytes(mib: number) {
  return BigInt(mib) * MIB;
}

export function bytesToMib(bytes: bigint) {
  return Number(bytes / MIB);
}
