import { describe, it, expect } from "vitest";
import {
  parseEquipes,
  parseResultEquMatches,
  parseClassement,
  parseChpRenc,
  parseJoueurs,
  parseLicenceB,
  parseParties,
  parseHistorique,
  parseEpreuves,
  parseDivisions,
  parseResCla,
} from "../../fftt/xml-parser.js";

// ─────────────────────────────────────────────────────────────────────────────
// parseEquipes
// ─────────────────────────────────────────────────────────────────────────────
describe("parseEquipes", () => {
  it("returns array of equipes from multiple items", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <equipe>
    <libequipe>USFTT 1</libequipe>
    <libdivision>Régionale 1</libdivision>
    <liendivision>cx_poule=123&amp;D1=456</liendivision>
    <idepr>EP001</idepr>
    <libepr>Championnat par équipes</libepr>
  </equipe>
  <equipe>
    <libequipe>USFTT 2</libequipe>
    <libdivision>Départementale 2</libdivision>
    <liendivision>cx_poule=789&amp;D1=012</liendivision>
    <idepr>EP002</idepr>
    <libepr>Championnat par équipes D2</libepr>
  </equipe>
</liste>`;

    const result = parseEquipes(xml);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      libEquipe: "USFTT 1",
      libDivision: "Régionale 1",
      lienDivision: "cx_poule=123&D1=456",
      idEpreuve: "EP001",
      libEpreuve: "Championnat par équipes",
    });
    expect(result[1].libEquipe).toBe("USFTT 2");
  });

  it("normalizes single item to array", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <equipe>
    <libequipe>USFTT 1</libequipe>
    <libdivision>Régionale 1</libdivision>
    <liendivision>cx_poule=123&amp;D1=456</liendivision>
    <idepr>EP001</idepr>
    <libepr>Championnat par équipes</libepr>
  </equipe>
</liste>`;

    const result = parseEquipes(xml);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("returns empty array when no equipes", () => {
    const xml = `<?xml version="1.0"?><liste></liste>`;
    const result = parseEquipes(xml);
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseResultEquMatches
// ─────────────────────────────────────────────────────────────────────────────
describe("parseResultEquMatches", () => {
  it("returns array of matches from multiple items", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <tour>
    <libelle>Journée 1</libelle>
    <equa>USFTT 1</equa>
    <equb>Club Adverse</equb>
    <scorea>3</scorea>
    <scoreb>6</scoreb>
    <lien>cx_poule=123&amp;D1=456&amp;renc_id=789</lien>
    <dateprevue>15/09/2024</dateprevue>
    <datereelle>15/09/2024</datereelle>
  </tour>
  <tour>
    <libelle>Journée 2</libelle>
    <equa>Club Adverse 2</equa>
    <equb>USFTT 1</equb>
    <scorea>5</scorea>
    <scoreb>4</scoreb>
    <lien>cx_poule=123&amp;D1=456&amp;renc_id=790</lien>
    <dateprevue>22/09/2024</dateprevue>
    <datereelle>22/09/2024</datereelle>
  </tour>
</liste>`;

    const result = parseResultEquMatches(xml);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      libelle: "Journée 1",
      equipeA: "USFTT 1",
      equipeB: "Club Adverse",
      scoreA: "3",
      scoreB: "6",
      lien: "cx_poule=123&D1=456&renc_id=789",
      datePrevue: "15/09/2024",
      dateReelle: "15/09/2024",
    });
  });

  it("normalizes single match to array", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <tour>
    <libelle>Journée 1</libelle>
    <equa>USFTT 1</equa>
    <equb>Club Adverse</equb>
    <scorea>3</scorea>
    <scoreb>6</scoreb>
    <lien>cx_poule=123</lien>
    <dateprevue>15/09/2024</dateprevue>
    <datereelle>15/09/2024</datereelle>
  </tour>
</liste>`;

    const result = parseResultEquMatches(xml);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("returns empty array when no tours", () => {
    const xml = `<?xml version="1.0"?><liste></liste>`;
    const result = parseResultEquMatches(xml);
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseClassement
// ─────────────────────────────────────────────────────────────────────────────
describe("parseClassement", () => {
  it("returns array of classement from multiple items", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <classement>
    <poule>Poule A</poule>
    <clt>1</clt>
    <equipe>USFTT 1</equipe>
    <joue>10</joue>
    <pts>20</pts>
    <numero>1001</numero>
    <totvic>10</totvic>
    <totdef>2</totdef>
    <idequipe>EQ001</idequipe>
    <idclub>CL001</idclub>
    <vic>10</vic>
    <def>2</def>
    <nul>0</nul>
    <pf>0</pf>
    <pg>50</pg>
    <pp>10</pp>
  </classement>
  <classement>
    <poule>Poule A</poule>
    <clt>2</clt>
    <equipe>Club B</equipe>
    <joue>10</joue>
    <pts>18</pts>
    <numero>1002</numero>
    <totvic>9</totvic>
    <totdef>3</totdef>
    <idequipe>EQ002</idequipe>
    <idclub>CL002</idclub>
    <vic>9</vic>
    <def>3</def>
    <nul>0</nul>
    <pf>0</pf>
    <pg>45</pg>
    <pp>15</pp>
  </classement>
</liste>`;

    const result = parseClassement(xml);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      poule: "Poule A",
      clt: "1",
      equipe: "USFTT 1",
      joue: "10",
      pts: "20",
      numero: "1001",
      totvic: "10",
      totdef: "2",
      idequipe: "EQ001",
      idclub: "CL001",
      vic: "10",
      def: "2",
      nul: "0",
      pf: "0",
      pg: "50",
      pp: "10",
    });
  });

  it("normalizes single classement to array", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <classement>
    <poule>Poule A</poule>
    <clt>1</clt>
    <equipe>USFTT 1</equipe>
    <joue>10</joue>
    <pts>20</pts>
    <numero>1001</numero>
    <totvic>10</totvic>
    <totdef>2</totdef>
    <idequipe>EQ001</idequipe>
    <idclub>CL001</idclub>
    <vic>10</vic>
    <def>2</def>
    <nul>0</nul>
    <pf>0</pf>
    <pg>50</pg>
    <pp>10</pp>
  </classement>
</liste>`;

    const result = parseClassement(xml);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseChpRenc
// ─────────────────────────────────────────────────────────────────────────────
describe("parseChpRenc", () => {
  it("parses rencontre with result, joueurs, and parties", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <resultat>
    <equa>USFTT 1</equa>
    <equb>Club Adverse</equb>
    <resa>6</resa>
    <resb>3</resb>
  </resultat>
  <joueur>
    <xja>Dupont Jean</xja>
    <xca>1234A</xca>
    <xjb>Martin Paul</xjb>
    <xcb>5678B</xcb>
  </joueur>
  <joueur>
    <xja>Durand Marie</xja>
    <xca>9012C</xca>
    <xjb>Petit Sophie</xjb>
    <xcb>3456D</xcb>
  </joueur>
  <partie>
    <ja>Dupont Jean</ja>
    <scorea>3</scorea>
    <jb>Martin Paul</jb>
    <scoreb>0</scoreb>
    <detail>11-5 11-3 11-4</detail>
  </partie>
  <partie>
    <ja>Durand Marie</ja>
    <scorea>0</scorea>
    <jb>Petit Sophie</jb>
    <scoreb>3</scoreb>
    <detail>5-11 3-11 4-11</detail>
  </partie>
</liste>`;

    const result = parseChpRenc(xml);
    expect(result.resultat).toEqual({
      equa: "USFTT 1",
      equb: "Club Adverse",
      resa: "6",
      resb: "3",
    });
    expect(result.joueurs).toHaveLength(2);
    expect(result.joueurs[0]).toEqual({
      xja: "Dupont Jean",
      xca: "1234A",
      xjb: "Martin Paul",
      xcb: "5678B",
    });
    expect(result.parties).toHaveLength(2);
    expect(result.parties[0]).toEqual({
      ja: "Dupont Jean",
      scorea: "3",
      jb: "Martin Paul",
      scoreb: "0",
      detail: "11-5 11-3 11-4",
    });
  });

  it("normalizes single joueur and single partie to array", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <resultat>
    <equa>USFTT 1</equa>
    <equb>Club Adverse</equb>
    <resa>3</resa>
    <resb>0</resb>
  </resultat>
  <joueur>
    <xja>Dupont Jean</xja>
    <xca>1234A</xca>
    <xjb>Martin Paul</xjb>
    <xcb>5678B</xcb>
  </joueur>
  <partie>
    <ja>Dupont Jean</ja>
    <scorea>3</scorea>
    <jb>Martin Paul</jb>
    <scoreb>0</scoreb>
    <detail>11-5 11-3 11-4</detail>
  </partie>
</liste>`;

    const result = parseChpRenc(xml);
    expect(Array.isArray(result.joueurs)).toBe(true);
    expect(result.joueurs).toHaveLength(1);
    expect(Array.isArray(result.parties)).toBe(true);
    expect(result.parties).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseJoueurs
// ─────────────────────────────────────────────────────────────────────────────
describe("parseJoueurs", () => {
  it("returns array of joueurs from multiple items", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <joueur>
    <licence>1234567A</licence>
    <nom>DUPONT</nom>
    <prenom>Jean</prenom>
    <club>USFTT</club>
    <nclub>07890123</nclub>
    <clast>1500</clast>
  </joueur>
  <joueur>
    <licence>7654321B</licence>
    <nom>MARTIN</nom>
    <prenom>Paul</prenom>
    <club>USFTT</club>
    <nclub>07890123</nclub>
    <clast>1200</clast>
  </joueur>
</liste>`;

    const result = parseJoueurs(xml);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      licence: "1234567A",
      nom: "DUPONT",
      prenom: "Jean",
      club: "USFTT",
      nclub: "07890123",
      clast: "1500",
    });
  });

  it("normalizes single joueur to array", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <joueur>
    <licence>1234567A</licence>
    <nom>DUPONT</nom>
    <prenom>Jean</prenom>
    <club>USFTT</club>
    <nclub>07890123</nclub>
    <clast>1500</clast>
  </joueur>
</liste>`;

    const result = parseJoueurs(xml);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("returns empty array when no joueurs", () => {
    const xml = `<?xml version="1.0"?><liste></liste>`;
    const result = parseJoueurs(xml);
    expect(result).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseLicenceB
// ─────────────────────────────────────────────────────────────────────────────
describe("parseLicenceB", () => {
  it("returns array of licences from multiple items", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <licence>
    <idlicence>111111</idlicence>
    <nom>DUPONT</nom>
    <prenom>Jean</prenom>
    <licence>1234567A</licence>
    <numclub>07890123</numclub>
    <nomclub>USFTT</nomclub>
    <sexe>M</sexe>
    <type>T</type>
    <point>1500</point>
    <cat>Senior</cat>
    <pointm>1500</pointm>
    <apointm>1500</apointm>
    <initm>1500</initm>
    <natio>FRA</natio>
  </licence>
  <licence>
    <idlicence>222222</idlicence>
    <nom>MARTIN</nom>
    <prenom>Paul</prenom>
    <licence>7654321B</licence>
    <numclub>07890123</numclub>
    <nomclub>USFTT</nomclub>
    <sexe>M</sexe>
    <type>T</type>
    <point>1200</point>
    <cat>Senior</cat>
    <pointm>1200</pointm>
    <apointm>1200</apointm>
    <initm>1200</initm>
    <natio>FRA</natio>
  </licence>
</liste>`;

    const result = parseLicenceB(xml);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      idlicence: "111111",
      nom: "DUPONT",
      prenom: "Jean",
      licence: "1234567A",
      numclub: "07890123",
      nomclub: "USFTT",
      sexe: "M",
      type: "T",
      point: "1500",
      cat: "Senior",
      pointm: "1500",
      apointm: "1500",
      initm: "1500",
      natio: "FRA",
    });
  });

  it("normalizes single licence to array", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <licence>
    <idlicence>111111</idlicence>
    <nom>DUPONT</nom>
    <prenom>Jean</prenom>
    <licence>1234567A</licence>
    <numclub>07890123</numclub>
    <nomclub>USFTT</nomclub>
    <sexe>M</sexe>
    <type>T</type>
    <point>1500</point>
    <cat>Senior</cat>
    <pointm>1500</pointm>
    <apointm>1500</apointm>
    <initm>1500</initm>
    <natio>FRA</natio>
  </licence>
</liste>`;

    const result = parseLicenceB(xml);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseParties
// ─────────────────────────────────────────────────────────────────────────────
describe("parseParties", () => {
  it("returns array of parties from multiple items", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <partie>
    <licence>1234567A</licence>
    <advlic>7654321B</advlic>
    <vd>V</vd>
    <numjourn>1</numjourn>
    <codechamp>CH001</codechamp>
    <date>15/09/2024</date>
    <advsexe>M</advsexe>
    <advnompre>MARTIN Paul</advnompre>
    <pointres>+3</pointres>
    <coefchamp>1.0</coefchamp>
    <advclaof>1200</advclaof>
  </partie>
  <partie>
    <licence>1234567A</licence>
    <advlic>9876543C</advlic>
    <vd>D</vd>
    <numjourn>2</numjourn>
    <codechamp>CH001</codechamp>
    <date>22/09/2024</date>
    <advsexe>F</advsexe>
    <advnompre>DURAND Marie</advnompre>
    <pointres>-2</pointres>
    <coefchamp>1.0</coefchamp>
    <advclaof>1600</advclaof>
  </partie>
</liste>`;

    const result = parseParties(xml);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      licence: "1234567A",
      advlic: "7654321B",
      vd: "V",
      numjourn: "1",
      codechamp: "CH001",
      date: "15/09/2024",
      advsexe: "M",
      advnompre: "MARTIN Paul",
      pointres: "+3",
      coefchamp: "1.0",
      advclaof: "1200",
    });
  });

  it("normalizes single partie to array", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <partie>
    <licence>1234567A</licence>
    <advlic>7654321B</advlic>
    <vd>V</vd>
    <numjourn>1</numjourn>
    <codechamp>CH001</codechamp>
    <date>15/09/2024</date>
    <advsexe>M</advsexe>
    <advnompre>MARTIN Paul</advnompre>
    <pointres>+3</pointres>
    <coefchamp>1.0</coefchamp>
    <advclaof>1200</advclaof>
  </partie>
</liste>`;

    const result = parseParties(xml);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseHistorique
// ─────────────────────────────────────────────────────────────────────────────
describe("parseHistorique", () => {
  it("returns array of historique from multiple items", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <histo>
    <echelon>Régional</echelon>
    <place>3</place>
    <point>1500</point>
    <saison>2023-2024</saison>
    <phase>1</phase>
  </histo>
  <histo>
    <echelon>Départemental</echelon>
    <place>1</place>
    <point>1200</point>
    <saison>2022-2023</saison>
    <phase>2</phase>
  </histo>
</liste>`;

    const result = parseHistorique(xml);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      echelon: "Régional",
      place: "3",
      point: "1500",
      saison: "2023-2024",
      phase: "1",
    });
  });

  it("normalizes single histo to array", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <histo>
    <echelon>Régional</echelon>
    <place>3</place>
    <point>1500</point>
    <saison>2023-2024</saison>
    <phase>1</phase>
  </histo>
</liste>`;

    const result = parseHistorique(xml);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseEpreuves
// ─────────────────────────────────────────────────────────────────────────────
describe("parseEpreuves", () => {
  it("returns array of epreuves from multiple items", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <epreuve>
    <idepreuve>EP001</idepreuve>
    <idorga>ORG001</idorga>
    <libelle>Championnat par équipes</libelle>
    <typepreuve>E</typepreuve>
  </epreuve>
  <epreuve>
    <idepreuve>EP002</idepreuve>
    <idorga>ORG001</idorga>
    <libelle>Criterium de classement</libelle>
    <typepreuve>I</typepreuve>
  </epreuve>
</liste>`;

    const result = parseEpreuves(xml);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      idepreuve: "EP001",
      idorga: "ORG001",
      libelle: "Championnat par équipes",
      typepreuve: "E",
    });
  });

  it("normalizes single epreuve to array", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <epreuve>
    <idepreuve>EP001</idepreuve>
    <idorga>ORG001</idorga>
    <libelle>Championnat par équipes</libelle>
    <typepreuve>E</typepreuve>
  </epreuve>
</liste>`;

    const result = parseEpreuves(xml);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseDivisions
// ─────────────────────────────────────────────────────────────────────────────
describe("parseDivisions", () => {
  it("returns array of divisions from multiple items", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <division>
    <iddivision>DIV001</iddivision>
    <libelle>Régionale 1</libelle>
  </division>
  <division>
    <iddivision>DIV002</iddivision>
    <libelle>Régionale 2</libelle>
  </division>
</liste>`;

    const result = parseDivisions(xml);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      iddivision: "DIV001",
      libelle: "Régionale 1",
    });
  });

  it("normalizes single division to array", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <division>
    <iddivision>DIV001</iddivision>
    <libelle>Régionale 1</libelle>
  </division>
</liste>`;

    const result = parseDivisions(xml);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// parseResCla
// ─────────────────────────────────────────────────────────────────────────────
describe("parseResCla", () => {
  it("returns array of classements from multiple items", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <classement>
    <rang>1</rang>
    <nom>DUPONT Jean</nom>
    <clt>1500</clt>
    <club>USFTT</club>
    <points>150</points>
  </classement>
  <classement>
    <rang>2</rang>
    <nom>MARTIN Paul</nom>
    <clt>1400</clt>
    <club>Club B</club>
    <points>140</points>
  </classement>
</liste>`;

    const result = parseResCla(xml);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      rang: "1",
      nom: "DUPONT Jean",
      clt: "1500",
      club: "USFTT",
      points: "150",
    });
  });

  it("normalizes single classement to array", () => {
    const xml = `<?xml version="1.0"?>
<liste>
  <classement>
    <rang>1</rang>
    <nom>DUPONT Jean</nom>
    <clt>1500</clt>
    <club>USFTT</club>
    <points>150</points>
  </classement>
</liste>`;

    const result = parseResCla(xml);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(1);
  });

  it("returns empty array when no classements", () => {
    const xml = `<?xml version="1.0"?><liste></liste>`;
    const result = parseResCla(xml);
    expect(result).toEqual([]);
  });
});
