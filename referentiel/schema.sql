-- Référentiel Babylon — schéma V0 (ÉBAUCHE PROPOSÉE, sera finalisée au palier 1)
-- Principe : une table « element » commune (identifiant stable + type),
-- des tables de détail par type, et une table « relation » typée.

PRAGMA foreign_keys = ON;

-- Dictionnaires -------------------------------------------------------------
CREATE TABLE type_element (
  code        TEXT PRIMARY KEY,          -- 'besoin', 'ressource', 'objet', 'installation', 'competence', 'technique', 'procede', ...
  libelle     TEXT NOT NULL
);

CREATE TABLE type_relation (
  code        TEXT PRIMARY KEY,          -- 'REQUIERT', 'CONSOMME', 'PRODUIT', 'ALIMENTE', ...
  libelle     TEXT NOT NULL,
  famille     TEXT NOT NULL CHECK (famille IN ('prerequis','transformation','utilisation','progression','consequence'))
);

-- Quelles relations sont autorisées entre quels types (contrôle de cohérence)
CREATE TABLE relation_autorisee (
  type_relation TEXT NOT NULL REFERENCES type_relation(code),
  type_source   TEXT NOT NULL REFERENCES type_element(code),
  type_cible    TEXT NOT NULL REFERENCES type_element(code),
  PRIMARY KEY (type_relation, type_source, type_cible)
);

CREATE TABLE unite (
  code        TEXT PRIMARY KEY,          -- 'kg', 'l', 'unite', 's', 'kJ', ...
  grandeur    TEXT NOT NULL              -- 'masse', 'volume', 'nombre', 'duree', 'energie', ...
);

-- Éléments ------------------------------------------------------------------
CREATE TABLE element (
  id          TEXT PRIMARY KEY,          -- identifiant stable lisible : 'res.bois_sec', 'tech.feu_friction'
  type        TEXT NOT NULL REFERENCES type_element(code),
  nom         TEXT NOT NULL,
  description TEXT,
  phase       INTEGER NOT NULL DEFAULT 1 CHECK (phase BETWEEN 1 AND 7),
  statut      TEXT NOT NULL DEFAULT 'PROPOSE' CHECK (statut IN ('VALIDE','PROPOSE')),
  version     INTEGER NOT NULL DEFAULT 1
);

-- Propriétés modulaires normalisées (physique, thermique, alimentaire, ...)
-- « cachee = 1 » : connue du moteur, à découvrir par le personnage.
CREATE TABLE propriete (
  element_id  TEXT NOT NULL REFERENCES element(id),
  module      TEXT NOT NULL,             -- 'physique','thermique','mecanique','alimentaire','biologique','chimique','energetique','degradation'
  cle         TEXT NOT NULL,             -- 'masse_volumique', 'pouvoir_calorifique', 'toxicite', ...
  valeur      REAL,
  valeur_txt  TEXT,
  unite       TEXT REFERENCES unite(code),
  cachee      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (element_id, module, cle)
);

-- Relations typées ----------------------------------------------------------
CREATE TABLE relation (
  id          INTEGER PRIMARY KEY,
  type        TEXT NOT NULL REFERENCES type_relation(code),
  source_id   TEXT NOT NULL REFERENCES element(id),
  cible_id    TEXT NOT NULL REFERENCES element(id),
  quantite    REAL,
  unite       TEXT REFERENCES unite(code),
  contexte    TEXT CHECK (contexte IN ('decouverte','apprentissage','execution') OR contexte IS NULL),
  condition   TEXT,                      -- JSON : expressions ET / OU / NON, seuils de compétence, conditions de monde
  parametres  TEXT                       -- JSON : durée, rendement, probabilité, ...
);
CREATE INDEX relation_source ON relation(source_id);
CREATE INDEX relation_cible  ON relation(cible_id);
