import { ethers } from 'ethers';

export function computeInvoiceHash(
  invoiceId: string,
  companyId: string,
  contractorId: string,
  amount: string,
  currency: string,
  issuedAt: Date
): string {
  const timestamp = BigInt(Math.floor(issuedAt.getTime() / 1000));

  return ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ['string', 'string', 'string', 'string', 'string', 'uint256'],
      [invoiceId, companyId, contractorId, amount, currency, timestamp]
    )
  );
}
