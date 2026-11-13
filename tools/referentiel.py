#!/usr/bin/env python3
"""
Outil du référentiel Babylon.

    python3 tools/referentiel.py construire   # YAML  -> referentiel/babylon.sqlite
    python3 tools/referentiel.py valider      # contrôles de cohérence -> referentiel/rapport-validation.md
    python3 tools/referentiel.py exporter     # -> data/referentiel.json + referentiel/export/referentiel.xlsx
    python3 tools/referentiel.py tout         # les trois (par défaut)

Code de sortie non nul si la validation trouve au moins une ERREUR.
Dépendances : PyYAML, openpyxl (pip install pyyaml openpyxl).
"""
from __future__ import annotations

import datetime as dt
import json
import sqlite3
import sys
from collections import defaultdict
from pathlib import Path

import yaml

RACINE = Path(__file__).resolve().parent.parent
REF = RACINE / "referentiel"
DONNEES = REF / "donnees"
BASE = REF / "babylon.sqlite"
RAPPORT = REF / "rapport-validation.md"
JSON_SORTIE = RACINE / "data" / "referentiel.json"
XLSX_SORTIE = REF / "export" / "referentiel.xlsx"
VERSION_SCHEMA = "1.0-propose"

# Clés YAML -> (type de relation, contexte)
CLES_LISTE = {            # valeurs : liste d'identifiants (ou de dicts {id, ...})
    "requiert": ("REQUIERT", "execution"),
    "decouverte": ("REQUIERT", "decouverte"),
    "apprentissage": ("REQUIERT", "apprentissage"),
    "utilise": ("UTILISE", "execution"),
    "alimente": ("ALIMENTE", "execution"),
    "entretient": ("ENTRETIENT", "execution"),
    "debloque": ("DEBLOQUE", "execution"),
}
CLES_QUANTITE = {         # valeurs : {identifiant: quantité | {quantite, parametres}}
    "consomme": "CONSOMME",
    "produit": "PRODUIT",
    "satisfait": "SATISFAIT",
    "aggrave": "AGGRAVE",
    "degrade": "DEGRADE",
}
CLES_UNIQUE = {           # valeur : un identifiant
    "met_en_oeuvre": "MET_EN_OEUVRE",
    "releve_de": "RELEVE_DE",
    "specialise": "SPECIALISE",
}
CLES_ELEMENT = {"id", "nom", "description", "phase", "statut", "unite", "attributs", "proprietes",
                "duree", "condition"}
MATERIELS = ("ressource", "objet", "installation")


# =============================================================================
# CONSTRUCTION
# =============================================================================
class ErreurSaisie(Exception):
    pass


class Connexion(sqlite3.Connection):
    """Connexion SQLite pouvant porter le rapport et les erreurs de saisie."""


def lire_yaml(chemin: Path):
    with open(chemin, encoding="utf-8") as f:
        return yaml.safe_load(f)


def construire(verbeux=True) -> sqlite3.Connection:
    if BASE.exists():
        BASE.unlink()
    cx = sqlite3.connect(BASE, factory=Connexion)
    cx.execute("PRAGMA foreign_keys = ON")
    cx.executescript((REF / "schema.sql").read_text(encoding="utf-8"))

    dico = lire_yaml(REF / "dictionnaires.yaml")
    prefixes = {}
    for t in dico["types_element"]:
        cx.execute("INSERT INTO type_element VALUES (?,?,?,?)", (t["code"], t["prefixe"], t["libelle"], t.get("description")))
        prefixes[t["prefixe"]] = t["code"]
    for r in dico["types_relation"]:
        cx.execute("INSERT INTO type_relation VALUES (?,?,?,?)", (r["code"], r["famille"], r["libelle"], r.get("quantifiee", 0)))
    for rel, couples in dico["relations_autorisees"].items():
        for s, c in couples:
            cx.execute("INSERT INTO relation_autorisee VALUES (?,?,?)", (rel, s, c))
    for u in dico["unites"]:
        cx.execute("INSERT INTO unite VALUES (?,?,?)", (u["code"], u["grandeur"], u["libelle"]))
    for m in dico["modules_propriete"]:
        cx.execute("INSERT INTO module_propriete VALUES (?,?)", (m["code"], m["libelle"]))

    elements, relations, proprietes = [], [], []
    erreurs_saisie = []
    for fichier in sorted(DONNEES.rglob("*.yaml")):
        if fichier.name == "depart.yaml":
            continue
        nom_fichier = str(fichier.relative_to(RACINE))
        for el in lire_yaml(fichier) or []:
            try:
                e, rels, props = analyser_element(el, prefixes, nom_fichier)
            except ErreurSaisie as ex:
                erreurs_saisie.append(f"{nom_fichier} : {ex}")
                continue
            elements.append(e); relations += rels; proprietes += props

    # Les éléments d'abord (sans contrainte d'existence des cibles : c'est le validateur qui les signale)
    ids = set()
    for e in elements:
        if e["id"] in ids:
            erreurs_saisie.append(f"{e['fichier']} : identifiant en double « {e['id']} »")
            continue
        ids.add(e["id"])
        cx.execute("INSERT INTO element (id,type,nom,description,phase,statut,unite,attributs,fichier) VALUES (?,?,?,?,?,?,?,?,?)",
                   (e["id"], e["type"], e["nom"], e.get("description"), e.get("phase", 1), e.get("statut", "PROPOSE"),
                    e.get("unite"), json.dumps(e.get("attributs", {}), ensure_ascii=False), e["fichier"]))
    cx.commit()

    # Relations et propriétés : on désactive temporairement les clés étrangères pour stocker aussi
    # les références invalides — le validateur doit pouvoir les montrer plutôt que planter.
    cx.execute("PRAGMA foreign_keys = OFF")
    for r in relations:
        cx.execute("INSERT INTO relation (type,source_id,cible_id,quantite,unite,contexte,condition,parametres) VALUES (?,?,?,?,?,?,?,?)",
                   (r["type"], r["source"], r["cible"], r.get("quantite"), r.get("unite"), r.get("contexte", "execution"),
                    json.dumps(r["condition"], ensure_ascii=False) if r.get("condition") else None,
                    json.dumps(r["parametres"], ensure_ascii=False) if r.get("parametres") else None))
    for p in proprietes:
        cx.execute("INSERT OR REPLACE INTO propriete VALUES (?,?,?,?,?,?,?)",
                   (p["element"], p["module"], p["cle"], p.get("valeur"), p.get("valeur_txt"), p.get("unite"), 1 if p.get("cachee") else 0))

    depart = lire_yaml(DONNEES / "depart.yaml") or {}
    for scen, d in depart.items():
        for eid in (d.get("connait") or []) + (d.get("monde") or []):
            cx.execute("INSERT OR IGNORE INTO depart VALUES (?,?)", (scen, eid))
    cx.execute("PRAGMA foreign_keys = ON")
    cx.commit()

    cx.erreurs_saisie = erreurs_saisie  # type: ignore[attr-defined]
    if verbeux:
        n = cx.execute("SELECT COUNT(*) FROM element").fetchone()[0]
        nr = cx.execute("SELECT COUNT(*) FROM relation").fetchone()[0]
        print(f"Construit : {n} éléments, {nr} relations -> {BASE.relative_to(RACINE)}")
        for e in erreurs_saisie:
            print("  ERREUR DE SAISIE :", e)
    return cx


def analyser_element(el: dict, prefixes: dict, fichier: str):
    if not isinstance(el, dict) or "id" not in el or "nom" not in el:
        raise ErreurSaisie(f"élément sans « id » ou « nom » : {el!r}")
    eid = el["id"]
    pre = eid.split(".", 1)[0]
    if "." not in eid or pre not in prefixes:
        raise ErreurSaisie(f"« {eid} » : préfixe inconnu (attendus : {', '.join(sorted(prefixes))})")
    typ = prefixes[pre]
    inconnues = set(el) - CLES_ELEMENT - set(CLES_LISTE) - set(CLES_QUANTITE) - set(CLES_UNIQUE)
    if inconnues:
        raise ErreurSaisie(f"« {eid} » : clé(s) inconnue(s) {sorted(inconnues)}")

    attributs = dict(el.get("attributs") or {})
    if "duree" in el:
        attributs["duree_s"] = el["duree"]
    if "condition" in el:
        attributs["condition"] = el["condition"]
    e = {"id": eid, "type": typ, "nom": el["nom"], "description": el.get("description"), "phase": el.get("phase", 1),
         "statut": el.get("statut", "PROPOSE"), "unite": el.get("unite"), "attributs": attributs, "fichier": fichier}

    rels = []
    for cle, (rtype, ctx) in CLES_LISTE.items():
        for item in el.get(cle) or []:
            if isinstance(item, dict):
                params = {k: v for k, v in item.items() if k not in ("id", "condition")}
                rels.append({"type": rtype, "source": eid, "cible": item["id"], "contexte": ctx,
                             "condition": item.get("condition"), "parametres": params or None})
            else:
                rels.append({"type": rtype, "source": eid, "cible": item, "contexte": ctx})
    for cle, rtype in CLES_QUANTITE.items():
        for cible, val in (el.get(cle) or {}).items():
            if isinstance(val, dict):
                rels.append({"type": rtype, "source": eid, "cible": cible, "quantite": val.get("quantite"),
                             "unite": val.get("unite"), "parametres": val.get("parametres")})
            else:
                rels.append({"type": rtype, "source": eid, "cible": cible, "quantite": val})
    for cle, rtype in CLES_UNIQUE.items():
        if el.get(cle):
            rels.append({"type": rtype, "source": eid, "cible": el[cle]})

    props = []
    for module, cles in (el.get("proprietes") or {}).items():
        for cle, val in (cles or {}).items():
            p = {"element": eid, "module": module, "cle": cle}
            if isinstance(val, dict):
                p.update({k: val.get(k) for k in ("valeur", "valeur_txt", "unite", "cachee")})
            elif isinstance(val, (int, float)):
                p["valeur"] = val
            else:
                p["valeur_txt"] = str(val)
            props.append(p)
    return e, rels, props


# =============================================================================
# VALIDATION
# =============================================================================
class Rapport:
    def __init__(self):
        self.lignes = []           # (niveau, controle, message)

    def erreur(self, ctrl, msg):   self.lignes.append(("ERREUR", ctrl, msg))
    def alerte(self, ctrl, msg):   self.lignes.append(("ALERTE", ctrl, msg))
    def info(self, ctrl, msg):     self.lignes.append(("INFO", ctrl, msg))

    def compte(self, niveau):
        return sum(1 for n, _, _ in self.lignes if n == niveau)


def charger(cx):
    E = {r[0]: {"id": r[0], "type": r[1], "nom": r[2], "unite": r[3], "attributs": json.loads(r[4] or "{}"), "fichier": r[5]}
         for r in cx.execute("SELECT id,type,nom,unite,attributs,fichier FROM element")}
    R = [dict(zip(("id", "type", "source", "cible", "quantite", "unite", "contexte", "condition", "parametres"), r))
         for r in cx.execute("SELECT id,type,source_id,cible_id,quantite,unite,contexte,condition,parametres FROM relation")]
    for r in R:
        r["condition"] = json.loads(r["condition"]) if r["condition"] else None
        r["parametres"] = json.loads(r["parametres"]) if r["parametres"] else {}
    return E, R


def ids_dans_condition(cond):
    """Identifiants cités dans une condition JSON (ET / OU / NON / compétence)."""
    if cond is None:
        return []
    if isinstance(cond, str):
        return [cond]
    if isinstance(cond, list):
        return [i for c in cond for i in ids_dans_condition(c)]
    out = []
    for k, v in cond.items():
        if k in ("et", "ou", "non"):
            out += ids_dans_condition(v)
        elif k == "competence":
            out.append(v)
    return out


def valider(cx) -> Rapport:
    rp = Rapport()
    for e in getattr(cx, "erreurs_saisie", []):
        rp.erreur("Saisie", e)
    E, R = charger(cx)
    autorisees = {(a, b, c) for a, b, c in cx.execute("SELECT * FROM relation_autorisee")}
    quantifiees = {c for (c,) in cx.execute("SELECT code FROM type_relation WHERE quantifiee=1")}
    unites = {c for (c,) in cx.execute("SELECT code FROM unite")}
    sortantes, entrantes = defaultdict(list), defaultdict(list)
    for r in R:
        sortantes[r["source"]].append(r); entrantes[r["cible"]].append(r)
    nom = lambda i: f"{E[i]['nom']} ({i})" if i in E else f"« {i} » (inexistant)"

    # 1. Références -----------------------------------------------------------
    for r in R:
        if r["cible"] not in E:
            rp.erreur("Références", f"{nom(r['source'])} {r['type']} un identifiant inexistant « {r['cible']} »")
        if r["condition"]:
            for i in ids_dans_condition(r["condition"]):
                if i not in E:
                    rp.erreur("Références", f"condition de {nom(r['source'])} cite « {i} » inexistant")
    for e in E.values():
        cond = e["attributs"].get("condition")
        for i in ids_dans_condition(cond):
            if i not in E:
                rp.erreur("Références", f"condition de {nom(e['id'])} cite « {i} » inexistant")
    for scen, eid in cx.execute("SELECT scenario, element_id FROM depart"):
        if eid not in E:
            rp.erreur("Références", f"scénario « {scen} » cite « {eid} » inexistant")

    # 2. Types de relations compatibles ---------------------------------------
    for r in R:
        if r["cible"] not in E:
            continue
        ts, tc = E[r["source"]]["type"], E[r["cible"]]["type"]
        if (r["type"], ts, tc) not in autorisees:
            rp.erreur("Types", f"relation non autorisée : {ts} —{r['type']}→ {tc} ({r['source']} → {r['cible']})")

    # 3. Quantités et unités --------------------------------------------------
    for e in E.values():
        if e["type"] in ("ressource", "objet") and not e["unite"]:
            rp.erreur("Unités", f"{nom(e['id'])} n'a pas d'unité de compte")
        if e["unite"] and e["unite"] not in unites:
            rp.erreur("Unités", f"{nom(e['id'])} : unité « {e['unite']} » inconnue")
    for r in R:
        if r["type"] in quantifiees:
            if r["quantite"] is None or r["quantite"] <= 0:
                rp.erreur("Quantités", f"{nom(r['source'])} {r['type']} {r['cible']} sans quantité positive")
        if r["unite"] and r["cible"] in E and E[r["cible"]]["unite"] and r["unite"] != E[r["cible"]]["unite"]:
            rp.erreur("Unités", f"{nom(r['source'])} {r['type']} {r['cible']} en « {r['unite']} » alors que l'élément se compte en « {E[r['cible']]['unite']} »")
        p = r["parametres"].get("probabilite") if r["parametres"] else None
        if isinstance(p, (int, float)) and not 0 < p <= 1:
            rp.erreur("Quantités", f"{nom(r['source'])} : probabilité {p} hors de ]0 ; 1]")

    # 4. Structure : procédés, techniques, compétences -------------------------
    for e in E.values():
        s = sortantes[e["id"]]
        if e["type"] == "procede":
            n = sum(1 for r in s if r["type"] == "MET_EN_OEUVRE")
            if n != 1:
                rp.erreur("Structure", f"{nom(e['id'])} doit mettre en œuvre exactement une technique (trouvé : {n})")
            if "duree_s" not in e["attributs"]:
                rp.alerte("Structure", f"{nom(e['id'])} n'a pas de durée")
            if not any(r["type"] in ("PRODUIT", "SATISFAIT", "DEBLOQUE", "ENTRETIENT") for r in s):
                rp.alerte("Structure", f"{nom(e['id'])} ne produit, ne satisfait, ne débloque et n'entretient rien")
        if e["type"] == "technique" and sum(1 for r in s if r["type"] == "RELEVE_DE") != 1:
            rp.erreur("Structure", f"{nom(e['id'])} doit relever d'exactement une compétence")
    for e in E.values():
        if e["type"] == "installation" and e["attributs"].get("consommation_kg_par_heure"):
            if not any(r["type"] == "ALIMENTE" for r in entrantes[e["id"]]):
                rp.erreur("Structure", f"{nom(e['id'])} consomme du combustible mais aucune ressource ne l'alimente (relation ALIMENTE)")
    parent = {r["source"]: r["cible"] for r in R if r["type"] == "SPECIALISE"}
    for c in parent:
        vu, x = set(), c
        while x in parent:
            if x in vu:
                rp.erreur("Structure", f"hiérarchie de compétences circulaire autour de {nom(c)}")
                break
            vu.add(x); x = parent[x]

    # 5. Origine : chaque ressource / objet / installation doit pouvoir être produite
    for e in E.values():
        if e["type"] in MATERIELS and not any(r["type"] == "PRODUIT" for r in entrantes[e["id"]]):
            rp.erreur("Origine", f"{nom(e['id'])} n'est produit par aucun procédé : impossible à obtenir")

    # 6. Accessibilité depuis chaque scénario de départ ------------------------
    scenarios = defaultdict(set)
    for scen, eid in cx.execute("SELECT scenario, element_id FROM depart"):
        scenarios[scen].add(eid)
    competence_de = {r["source"]: r["cible"] for r in R if r["type"] == "RELEVE_DE"}
    for scen, depart in scenarios.items():
        atteint, procs, ordre = accessibilite(E, R, sortantes, competence_de, parent, depart)
        bloques = [i for i, e in E.items() if e["type"] in MATERIELS + ("technique", "connaissance", "procede") and i not in atteint and i not in procs]
        for i in sorted(bloques):
            rp.erreur("Accessibilité", f"[{scen}] {nom(i)} n'est jamais atteignable : {cause_blocage(i, E, R, sortantes, atteint, procs)}")
        for e in E.values():
            if e["type"] == "besoin":
                ok = [r["source"] for r in entrantes[e["id"]] if r["type"] == "SATISFAIT" and r["source"] in procs]
                if not ok:
                    rp.erreur("Besoins", f"[{scen}] {nom(e['id'])} ne peut être satisfait par aucun procédé accessible")
        for i in [x for x in E if E[x]["type"] == "source" and x not in depart]:
            rp.alerte("Accessibilité", f"[{scen}] la source {nom(i)} n'est pas présente dans ce scénario")
        rp.info("Accessibilité", f"[{scen}] {len(procs)} procédés exécutables sur {sum(1 for e in E.values() if e['type']=='procede')} ; ordre de découverte : "
                + " → ".join(E[i]["nom"] for i in ordre if E[i]["type"] in ("technique", "connaissance")))

    # 7. Cycles : légitimes (amorçables) ou bloquants -------------------------
    graphe = graphe_dependances(E, R)
    atteint_global = _atteint_global(E, R, sortantes, competence_de, parent, scenarios)
    for comp in composantes_fortes(graphe):
        if len(comp) < 2:
            continue
        noms = ", ".join(sorted(comp))
        if comp <= atteint_global:
            rp.info("Cycles", f"boucle d'amélioration légitime (amorçable) : {noms}")
        else:
            rp.erreur("Cycles", f"dépendance circulaire bloquante : {noms}")

    # 8. Éléments isolés, propriétés cachées ------------------------------------
    for e in E.values():
        if not sortantes[e["id"]] and not entrantes[e["id"]]:
            rp.alerte("Isolés", f"{nom(e['id'])} n'est relié à rien")
    for eid, mod, cle in cx.execute("SELECT element_id, module, cle FROM propriete WHERE cachee=1"):
        rp.info("Découverte", f"propriété cachée : {nom(eid)} — {mod}.{cle}")
    return rp


def _atteint_global(E, R, sortantes, competence_de, parent, scenarios):
    tout = set()
    for depart in scenarios.values():
        a, p, _ = accessibilite(E, R, sortantes, competence_de, parent, depart)
        tout |= a | p
    return tout


def accessibilite(E, R, sortantes, competence_de, parent, depart):
    """Point fixe : ce que l'on peut atteindre depuis l'état de départ.
    Une technique est connue si elle est au départ, ou si ses prérequis de découverte sont atteints.
    Un procédé est exécutable si sa technique est connue, ses prérequis présents, ses entrées obtenables,
    un outil de chaque groupe « OU » disponible, et ses conditions de compétence entraînables."""
    atteint = set(depart)
    procs = set()
    competences_entrainees = set()
    ordre = []

    def ajoute(i):
        if i not in atteint:
            atteint.add(i); ordre.append(i)

    def cond_ok(cond):
        if cond is None:
            return True
        if isinstance(cond, str):
            return cond in atteint
        if isinstance(cond, list):
            return all(cond_ok(c) for c in cond)
        if "et" in cond:
            return all(cond_ok(c) for c in cond["et"])
        if "ou" in cond:
            return any(cond_ok(c) for c in cond["ou"])
        if "non" in cond:
            return True  # une négation ne bloque pas l'accessibilité
        if "competence" in cond:
            return cond["competence"] in competences_entrainees
        return True

    change = True
    while change:
        change = False
        for i, e in E.items():
            s = sortantes[i]
            if e["type"] == "technique" and i not in atteint:
                if all(r["cible"] in atteint for r in s if r["type"] == "REQUIERT" and r["contexte"] == "decouverte"):
                    ajoute(i); change = True
            if e["type"] == "procede" and i not in procs:
                tech = [r["cible"] for r in s if r["type"] == "MET_EN_OEUVRE"]
                if not tech or tech[0] not in atteint:
                    continue
                if not all(r["cible"] in atteint for r in s if r["type"] == "REQUIERT" and r["contexte"] == "execution"):
                    continue
                if not all(r["cible"] in atteint for r in s if r["type"] == "CONSOMME"):
                    continue
                groupes = defaultdict(list)
                for r in s:
                    if r["type"] == "UTILISE" and not r["parametres"].get("optionnel"):
                        groupes[r["parametres"].get("groupe", r["cible"])].append(r["cible"])
                if not all(any(c in atteint for c in g) for g in groupes.values()):
                    continue
                if not cond_ok(e["attributs"].get("condition")):
                    # la compétence s'entraîne avec d'autres procédés de la même technique/compétence
                    continue
                procs.add(i); change = True
                c = competence_de.get(tech[0])
                while c:
                    competences_entrainees.add(c); c = parent.get(c)
                for r in s:
                    if r["type"] in ("PRODUIT", "DEBLOQUE"):
                        ajoute(r["cible"])
        # second tour pour les conditions de compétence
    return atteint, procs, ordre


def cause_blocage(i, E, R, sortantes, atteint, procs):
    e = E[i]
    if e["type"] == "technique":
        manque = [r["cible"] for r in sortantes[i] if r["type"] == "REQUIERT" and r["contexte"] == "decouverte" and r["cible"] not in atteint]
        return "découverte impossible, il manque " + ", ".join(manque) if manque else "aucun moyen de la découvrir"
    if e["type"] == "procede":
        s = sortantes[i]
        manque = [r["cible"] for r in s if r["type"] in ("MET_EN_OEUVRE", "REQUIERT", "CONSOMME") and r["cible"] not in atteint]
        manque += [r["cible"] for r in s if r["type"] == "UTILISE" and not r["parametres"].get("optionnel") and r["cible"] not in atteint]
        if e["attributs"].get("condition"):
            manque.append("condition " + json.dumps(e["attributs"]["condition"], ensure_ascii=False))
        return "il manque " + ", ".join(dict.fromkeys(manque))
    prod = [r["source"] for r in R if r["cible"] == i and r["type"] in ("PRODUIT", "DEBLOQUE")]
    return ("ses procédés d'obtention sont bloqués : " + ", ".join(prod)) if prod else "rien ne le produit ni ne le débloque"


def graphe_dependances(E, R):
    """Arc A -> B : « A a besoin de B pour exister »."""
    g = defaultdict(set)
    for r in R:
        if r["cible"] not in E:
            continue
        if r["type"] in ("REQUIERT", "CONSOMME", "MET_EN_OEUVRE") or (r["type"] == "UTILISE" and not r["parametres"].get("optionnel") and not r["parametres"].get("groupe")):
            g[r["source"]].add(r["cible"])
        if r["type"] in ("PRODUIT", "DEBLOQUE"):
            g[r["cible"]].add(r["source"])
    return g


def composantes_fortes(g):
    """Tarjan itératif."""
    index, low, pile, sur_pile, res, n = {}, {}, [], set(), [], [0]
    noeuds = set(g) | {v for vs in g.values() for v in vs}
    for depart in noeuds:
        if depart in index:
            continue
        travail = [(depart, iter(g.get(depart, ())))]
        index[depart] = low[depart] = n[0]; n[0] += 1; pile.append(depart); sur_pile.add(depart)
        while travail:
            v, it = travail[-1]
            avance = False
            for w in it:
                if w not in index:
                    index[w] = low[w] = n[0]; n[0] += 1; pile.append(w); sur_pile.add(w)
                    travail.append((w, iter(g.get(w, ())))); avance = True; break
                elif w in sur_pile:
                    low[v] = min(low[v], index[w])
            if avance:
                continue
            travail.pop()
            if travail:
                low[travail[-1][0]] = min(low[travail[-1][0]], low[v])
            if low[v] == index[v]:
                comp = set()
                while True:
                    w = pile.pop(); sur_pile.discard(w); comp.add(w)
                    if w == v:
                        break
                res.append(comp)
    return res


def ecrire_rapport(rp: Rapport, cx):
    n = cx.execute("SELECT COUNT(*) FROM element").fetchone()[0]
    par_type = cx.execute("SELECT type, COUNT(*) FROM element GROUP BY type ORDER BY type").fetchall()
    nr = cx.execute("SELECT COUNT(*) FROM relation").fetchone()[0]
    L = [f"# Rapport de validation du référentiel",
         "", f"*Généré par `tools/referentiel.py` — ne pas modifier à la main.*", "",
         f"- **{n} éléments**, **{nr} relations** — " + ", ".join(f"{t} : {c}" for t, c in par_type),
         f"- Résultat : **{rp.compte('ERREUR')} erreur(s)**, {rp.compte('ALERTE')} alerte(s), {rp.compte('INFO')} information(s)", ""]
    for niveau, titre in (("ERREUR", "Erreurs"), ("ALERTE", "Alertes"), ("INFO", "Informations")):
        lignes = [(c, m) for nv, c, m in rp.lignes if nv == niveau]
        L.append(f"## {titre}"); L.append("")
        if not lignes:
            L.append("Aucune."); L.append(""); continue
        L.append("| Contrôle | Détail |"); L.append("|---|---|")
        for c, m in lignes:
            L.append(f"| {c} | {m.replace('|', '/')} |")
        L.append("")
    RAPPORT.write_text("\n".join(L), encoding="utf-8")


# =============================================================================
# EXPORT
# =============================================================================
def exporter(cx):
    E, R = charger(cx)
    props = defaultdict(lambda: defaultdict(dict))
    for eid, mod, cle, val, txt, u, cachee in cx.execute("SELECT * FROM propriete"):
        props[eid][mod][cle] = {k: v for k, v in (("valeur", val), ("texte", txt), ("unite", u), ("cachee", bool(cachee))) if v not in (None, False)}
    desc = {r[0]: r[1] for r in cx.execute("SELECT id, description FROM element")}
    statut = {r[0]: r[1] for r in cx.execute("SELECT id, statut FROM element")}
    phase = {r[0]: r[1] for r in cx.execute("SELECT id, phase FROM element")}
    depart = defaultdict(list)
    for s, eid in cx.execute("SELECT scenario, element_id FROM depart"):
        depart[s].append(eid)
    sortie = {
        "version_schema": VERSION_SCHEMA,
        "genere_le": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "types": [dict(zip(("code", "prefixe", "libelle", "description"), r)) for r in cx.execute("SELECT * FROM type_element")],
        "types_relation": [dict(zip(("code", "famille", "libelle", "quantifiee"), r)) for r in cx.execute("SELECT * FROM type_relation")],
        "elements": [{"id": e["id"], "type": e["type"], "nom": e["nom"], "description": desc[e["id"]], "phase": phase[e["id"]],
                      "statut": statut[e["id"]], "unite": e["unite"], "attributs": e["attributs"], "proprietes": props.get(e["id"], {})}
                     for e in E.values()],
        "relations": [{k: v for k, v in r.items() if v not in (None, {}, "execution") or k == "contexte" and v != "execution"} for r in R],
        "depart": depart,
    }
    rp = getattr(cx, "rapport", None)
    if rp:
        sortie["validation"] = {"erreurs": rp.compte("ERREUR"), "alertes": rp.compte("ALERTE"),
                                "lignes": [{"niveau": n, "controle": c, "message": m} for n, c, m in rp.lignes]}
    JSON_SORTIE.parent.mkdir(parents=True, exist_ok=True)
    JSON_SORTIE.write_text(json.dumps(sortie, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Exporté : {JSON_SORTIE.relative_to(RACINE)}")
    exporter_xlsx(cx, E, R)


def exporter_xlsx(cx, E, R):
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter
    wb = Workbook()
    entete = Font(bold=True, color="FFFFFF"); fond = PatternFill("solid", fgColor="5A4122")

    def feuille(ws, titres, lignes, largeurs):
        ws.append(titres)
        for c in ws[1]:
            c.font = entete; c.fill = fond; c.alignment = Alignment(vertical="center")
        for l in lignes:
            ws.append(l)
        for i, w in enumerate(largeurs, 1):
            ws.column_dimensions[get_column_letter(i)].width = w
        ws.freeze_panes = "A2"; ws.auto_filter.ref = ws.dimensions

    ws = wb.active; ws.title = "Éléments"
    feuille(ws, ["Identifiant", "Type", "Nom", "Unité", "Phase", "Statut", "Durée (s)", "Description", "Fichier"],
            [[r[0], r[1], r[2], r[3], r[4], r[5], json.loads(r[6]).get("duree_s"), r[7], r[8]]
             for r in cx.execute("SELECT id,type,nom,unite,phase,statut,attributs,description,fichier FROM element ORDER BY type,id")],
            [28, 14, 38, 8, 7, 10, 10, 60, 40])
    ws = wb.create_sheet("Relations")
    feuille(ws, ["Source", "Nom source", "Relation", "Cible", "Nom cible", "Quantité", "Unité", "Contexte", "Paramètres"],
            [[r["source"], E.get(r["source"], {}).get("nom"), r["type"], r["cible"], E.get(r["cible"], {}).get("nom"),
              r["quantite"], r["unite"] or E.get(r["cible"], {}).get("unite"), r["contexte"],
              json.dumps(r["parametres"], ensure_ascii=False) if r["parametres"] else None] for r in R],
            [28, 34, 15, 28, 34, 10, 8, 12, 40])
    ws = wb.create_sheet("Propriétés")
    feuille(ws, ["Élément", "Nom", "Module", "Clé", "Valeur", "Texte", "Unité", "Cachée"],
            [[r[0], E[r[0]]["nom"] if r[0] in E else None, r[1], r[2], r[3], r[4], r[5], "oui" if r[6] else ""]
             for r in cx.execute("SELECT * FROM propriete ORDER BY element_id")], [28, 30, 14, 24, 10, 22, 8, 8])
    rp = getattr(cx, "rapport", None)
    if rp:
        ws = wb.create_sheet("Validation")
        feuille(ws, ["Niveau", "Contrôle", "Détail"], [list(l) for l in rp.lignes], [10, 16, 120])
    XLSX_SORTIE.parent.mkdir(parents=True, exist_ok=True)
    wb.save(XLSX_SORTIE)
    print(f"Exporté : {XLSX_SORTIE.relative_to(RACINE)}")


# =============================================================================
def main(argv):
    cmd = argv[1] if len(argv) > 1 else "tout"
    if cmd not in ("construire", "valider", "exporter", "tout"):
        print(__doc__); return 2
    cx = construire()
    code = 0
    if cmd in ("valider", "tout", "exporter"):
        rp = valider(cx); cx.rapport = rp  # type: ignore[attr-defined]
        ecrire_rapport(rp, cx)
        print(f"Validation : {rp.compte('ERREUR')} erreur(s), {rp.compte('ALERTE')} alerte(s), {rp.compte('INFO')} info(s) -> {RAPPORT.relative_to(RACINE)}")
        for niveau, ctrl, msg in rp.lignes:
            if niveau != "INFO":
                print(f"  {niveau:6} [{ctrl}] {msg}")
        code = 1 if rp.compte("ERREUR") else 0
    if cmd in ("exporter", "tout"):
        exporter(cx)
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv))
