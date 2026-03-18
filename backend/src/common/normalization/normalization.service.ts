import { BadRequestException, Injectable } from '@nestjs/common';
import { ChainFamily } from '@prisma/client';

@Injectable()
export class NormalizationService {
  private readonly evmAddressPattern = /^0x[a-fA-F0-9]{40}$/u;
  private readonly tronAddressPattern = /^T[1-9A-HJ-NP-Za-km-z]{33}$/u;
  private readonly solanaAddressPattern = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/u;
  private readonly chainAliases = new Map<string, string>([
    ['base mainnet', 'base'],
    ['base-mainnet', 'base'],
    ['bnb smart chain', 'bnb-smart-chain'],
    ['bnb-smart-chain', 'bnb-smart-chain'],
    ['binance smart chain', 'bnb-smart-chain'],
    ['binance-smart-chain', 'bnb-smart-chain'],
    ['bsc', 'bnb-smart-chain'],
    ['bep20', 'bnb-smart-chain'],
  ]);

  normalizePartnerSlug(value: string): string {
    return this.requireTrimmed(value, 'partnerSlug').toLowerCase();
  }

  normalizeIdentifier(value: string): string {
    return this.requireTrimmed(value, 'recipientIdentifier').toLowerCase();
  }

  normalizeChain(value: string): string {
    const normalizedValue = this.requireTrimmed(value, 'chain').toLowerCase();

    return this.chainAliases.get(normalizedValue) ?? normalizedValue;
  }

  normalizeAssetCode(value: string): string {
    return this.requireTrimmed(value, 'assetCode').toLowerCase();
  }

  normalizeAssetSymbol(value: string): string {
    return this.requireTrimmed(value, 'assetSymbol').toUpperCase();
  }

  normalizeMemo(value?: string): string {
    return value?.trim() ?? '';
  }

  normalizeAddress(chainSlug: string, address: string): string {
    const trimmedAddress = this.requireTrimmed(address, 'address');
    const family = this.detectChainFamily(chainSlug);

    if (family === ChainFamily.EVM) {
      if (!this.evmAddressPattern.test(trimmedAddress)) {
        throw new BadRequestException('Invalid EVM address format.');
      }

      return trimmedAddress.toLowerCase();
    }

    if (family === ChainFamily.TRON) {
      if (!this.tronAddressPattern.test(trimmedAddress)) {
        throw new BadRequestException('Invalid Tron address format.');
      }

      return trimmedAddress;
    }

    if (family === ChainFamily.SOLANA) {
      if (!this.solanaAddressPattern.test(trimmedAddress)) {
        throw new BadRequestException('Invalid Solana address format.');
      }

      return trimmedAddress;
    }

    return trimmedAddress;
  }

  normalizeContractAddress(
    chainSlug: string,
    contractAddress?: string,
  ): string {
    if (!contractAddress) {
      return '';
    }

    return this.normalizeAddress(chainSlug, contractAddress);
  }

  detectChainFamily(chainSlug: string): ChainFamily {
    const normalizedChainSlug = this.normalizeChain(chainSlug);

    if (
      [
        'ethereum',
        'base',
        'arbitrum',
        'optimism',
        'polygon',
        'bnb-smart-chain',
      ].includes(normalizedChainSlug)
    ) {
      return ChainFamily.EVM;
    }

    if (normalizedChainSlug === 'tron') {
      return ChainFamily.TRON;
    }

    if (normalizedChainSlug === 'solana') {
      return ChainFamily.SOLANA;
    }

    return ChainFamily.OTHER;
  }

  addressLooksLikeReference(
    candidateAddress: string,
    referenceAddress: string,
  ): boolean {
    const normalizedCandidateAddress = candidateAddress.trim();
    const normalizedReferenceAddress = referenceAddress.trim();

    if (
      normalizedCandidateAddress.length < 10 ||
      normalizedReferenceAddress.length < 10 ||
      normalizedCandidateAddress === normalizedReferenceAddress
    ) {
      return false;
    }

    const sharedPrefixLength = this.countSharedPrefixLength(
      normalizedCandidateAddress,
      normalizedReferenceAddress,
    );
    const sharedSuffixLength = this.countSharedSuffixLength(
      normalizedCandidateAddress,
      normalizedReferenceAddress,
    );

    return sharedPrefixLength >= 4 && sharedSuffixLength >= 4;
  }

  private requireTrimmed(value: string, fieldName: string): string {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      throw new BadRequestException(`${fieldName} must not be empty.`);
    }

    return trimmedValue;
  }

  private countSharedPrefixLength(left: string, right: string): number {
    const maxLength = Math.min(left.length, right.length);
    let index = 0;

    while (index < maxLength && left[index] === right[index]) {
      index += 1;
    }

    return index;
  }

  private countSharedSuffixLength(left: string, right: string): number {
    const maxLength = Math.min(left.length, right.length);
    let index = 0;

    while (
      index < maxLength &&
      left[left.length - 1 - index] === right[right.length - 1 - index]
    ) {
      index += 1;
    }

    return index;
  }
}
