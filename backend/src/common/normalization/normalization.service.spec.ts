import { BadRequestException } from '@nestjs/common';
import { ChainFamily } from '@prisma/client';
import { NormalizationService } from './normalization.service';

describe('NormalizationService', () => {
  const service = new NormalizationService();

  it('normalizes EVM addresses to lowercase', () => {
    expect(
      service.normalizeAddress(
        'ethereum',
        '0x8ba1f109551bD432803012645Ac136ddd64DBA72',
      ),
    ).toBe('0x8ba1f109551bd432803012645ac136ddd64dba72');
  });

  it('rejects invalid tron addresses', () => {
    expect(() =>
      service.normalizeAddress('tron', 'not-a-tron-address'),
    ).toThrow(BadRequestException);
  });

  it('detects solana family from chain slug', () => {
    expect(service.detectChainFamily('solana')).toBe(ChainFamily.SOLANA);
  });

  it('normalizes base mainnet aliases to the canonical base slug', () => {
    expect(service.normalizeChain('Base Mainnet')).toBe('base');
  });

  it('normalizes bnb smart chain aliases to the canonical slug', () => {
    expect(service.normalizeChain('bsc')).toBe('bnb-smart-chain');
  });

  it('detects bnb smart chain as an EVM family network', () => {
    expect(service.detectChainFamily('bnb-smart-chain')).toBe(ChainFamily.EVM);
  });

  it('flags lookalike addresses when prefix and suffix match', () => {
    expect(
      service.addressLooksLikeReference(
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        '0x8ba1f109551bd432803012645ac136ddd64cba72',
      ),
    ).toBe(true);
  });

  it('does not flag an exact address match as a lookalike', () => {
    expect(
      service.addressLooksLikeReference(
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
      ),
    ).toBe(false);
  });

  it('requires both a shared prefix and suffix for lookalike detection', () => {
    expect(
      service.addressLooksLikeReference(
        '0x8ba1f109551bd432803012645ac136ddd64dba72',
        '0x1cc1f109551bd432803012645ac136ddd64dba72',
      ),
    ).toBe(false);
  });
});
