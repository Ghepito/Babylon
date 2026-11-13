-- Référentiel Babylon — schéma V1 (PROPOSÉ, palier 1)
--
-- Principe :
--   * une table « element » commune : identifiant stable lisible + type + attributs propres au type (JSON)
--   * des propriétés modulaires normalisées, éventuellement cachées au personnage
--   * une table « relation » typée ; les combinaisons autorisées sont déclarées dans « relation_autorisee »
-- La base est construite par tools/referentiel.py à partir des fichiers YAML de referentiel/donnees/.

PRAGMA foreign_keys = ON;

-- Dictionnaires -------------------------------------------------------------
CREATE TABLE type_element (
  code        TEXT PRIMARY KEY,          -- 'besoin', 'source', 'ressource', 'objet', 'installation', 'competence', 'technique', 'connaissance', 'procede'
  prefixe     TEXT NOT NULL UNIQUE,      -- préfixe obligatoire des identifiants : 'bes', 'src', 'res', ...
  libelle     TEXT NOT NULL,
  description TEXT
);

CREATE TABLE type_relation (
  code        TEXT PRIMARY KEY,          -- 'REQUIERT', 'CONSOMME', 'PRODUIT', ...
  famille     TEXT NOT NULL CHECK (famille IN ('prerequis','transformation','utilisation','progression','consequence','structure')),
  libelle     TEXT NOT NULL,
  quantifiee  INTEGER NOT NULL DEFAULT 0  -- 1 : la relation porte obligatoirement une quantité
);

CREATE TABLE relation_autorisee (
  type_relation TEXT NOT NULL REFERENCES type_relation(code),
  type_source   TEXT NOT NULL REFERENCES type_element(code),
  type_cible    TEXT NOT NULL REFERENCES type_element(code),
  PRIMARY KEY (type_relation, type_source, type_cible)
);

CREATE TABLE unite (
  code        TEXT PRIMARY KEY,          -- 'kg', 'l', 'u', 's', 'pts', ...
  grandeur    TEXT NOT NULL,             -- 'masse', 'volume', 'nombre', 'duree', 'besoin', ...
  libelle     TEXT NOT NULL
);

-- Éléments ------------------------------------------------------------------
CREATE TABLE element (
  id          TEXT PRIMARY KEY,          -- 'res.bois_sec', 'tech.allumage_friction', ...
  type        TEXT NOT NULL REFERENCES type_element(code),
  nom         TEXT NOT NULL,
  description TEXT,
  phase       INTEGER NOT NULL DEFAULT 1 CHECK (phase BETWEEN 1 AND 7),
  statut      TEXT NOT NULL DEFAULT 'PROPOSE' CHECK (statut IN ('VALIDE','PROPOSE')),
  unite       TEXT REFERENCES unite(code), -- unité de compte des ressources et objets
  attributs   TEXT NOT NULL DEFAULT '{}',  -- JSON propre au type (durée d'un procédé, inné, ...)
  fichier     TEXT                         -- fichier source YAML (traçabilité)
);

-- Propriétés modulaires : connues du moteur ; « cachee = 1 » → à découvrir par le personnage.
CREATE TABLE module_propriete (
  code        TEXT PRIMARY KEY,          -- 'physique','thermique','mecanique','alimentaire','biologique','chimique','energetique','degradation'
  libelle     TEXT NOT NULL
);

CREATE TABLE propriete (
  element_id  TEXT NOT NULL REFERENCES element(id),
  module      TEXT NOT NULL REFERENCES module_propriete(code),
  cle         TEXT NOT NULL,
  valeur      REAL,
  valeur_txt  TEXT,
  unite       TEXT REFERENCES unite(code),
  cachee      INTEGER NOT NULL DEFAULT 0 CHECK (cachee IN (0,1)),
  PRIMARY KEY (element_id, module, cle)
);

-- Relations -----------------------------------------------------------------
CREATE TABLE relation (
  id          INTEGER PRIMARY KEY,
  type        TEXT NOT NULL REFERENCES type_relation(code),
  source_id   TEXT NOT NULL REFERENCES element(id),
  cible_id    TEXT NOT NULL REFERENCES element(id),
  quantite    REAL,
  unite       TEXT REFERENCES unite(code),
  contexte    TEXT NOT NULL DEFAULT 'execution' CHECK (contexte IN ('decouverte','apprentissage','execution')),
  condition   TEXT,                      -- JSON : {"et":[...]}, {"ou":[...]}, {"non":...}, {"competence":"comp.x","min":25}
  parametres  TEXT                       -- JSON libre : rendement, probabilité, usure...
);
CREATE INDEX relation_source ON relation(source_id);
CREATE INDEX relation_cible  ON relation(cible_id);
CREATE INDEX relation_type   ON relation(type);

-- Scénario de départ (sert à l'analyse d'accessibilité) --------------------
CREATE TABLE depart (
  scenario    TEXT NOT NULL,
  element_id  TEXT NOT NULL REFERENCES element(id),
  PRIMARY KEY (scenario, element_id)
);
