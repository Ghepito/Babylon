// Générateur pseudo-aléatoire à graine (mulberry32) : une même graine rejoue exactement la même partie.
export class Aleatoire {
  constructor(graine = 1) { this.etat = graine >>> 0; }
  suivant() {
    let t = (this.etat = (this.etat + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** Vrai avec la probabilité p. */
  tirage(p) { return p >= 1 || this.suivant() < p; }
}
