const SG = require('@waves/waves-signature-generator')

function blake2b(input) {
    return SG.libs.blake2b.blake2b(input, null, 32);
}

function keccak(input) {
    return SG.libs.keccak256.array(input);
}

function hashChain(input){
    return keccak(blake2b(input));
}

export function publicKeyHashFromAddress(address){
    const rawPKHash = SG.libs.base58.decode(address).slice(2,22)
    return SG.libs.base58.encode(rawPKHash)
}

export function publicKeyHashFromPK(pk){
    const decodedPK =  SG.libs.base58.decode(pk)
    const rawPKHash = hashChain(decodedPK).slice(0,20)
    return SG.libs.base58.encode(rawPKHash)
}
