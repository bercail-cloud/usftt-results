import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the client module before importing endpoints
vi.mock("../../fftt/client.js", () => ({
  fetchFftt: vi.fn(),
}));

import { fetchFftt } from "../../fftt/client.js";
import {
  getEquipes,
  getResultEquMatches,
  getResultEquClassement,
  getResultEquPoules,
  getChpRenc,
  getJoueurs,
  getLicenceB,
  getPartieMysql,
  getHistoClassement,
  getEpreuves,
  getDivisions,
  getResCla,
  getResultIndivPoules,
  getResultIndivClassement,
  getResultIndivParties,
} from "../../fftt/endpoints.js";

const mockFetch = vi.mocked(fetchFftt);

const APP_ID = "A001";
const SERIE = "ABC123";
const PASSWORD = "FFTT";

// Minimal valid XML responses for each endpoint
const EQUIPES_XML = `<?xml version="1.0"?>
<liste>
  <equipe>
    <libequipe>USFTT 1</libequipe>
    <libdivision>R1</libdivision>
    <liendivision>cx_poule=1&amp;D1=2</liendivision>
    <idepr>EP1</idepr>
    <libepr>Champ</libepr>
  </equipe>
</liste>`;

const MATCHES_XML = `<?xml version="1.0"?>
<liste>
  <tour>
    <libelle>J1</libelle>
    <equa>A</equa>
    <equb>B</equb>
    <scorea>3</scorea>
    <scoreb>6</scoreb>
    <lien>lien</lien>
    <dateprevue>01/01/2024</dateprevue>
    <datereelle>01/01/2024</datereelle>
  </tour>
</liste>`;

const CLASSEMENT_XML = `<?xml version="1.0"?>
<liste>
  <classement>
    <poule>P1</poule>
    <clt>1</clt>
    <equipe>USFTT</equipe>
    <joue>5</joue>
    <pts>10</pts>
    <numero>1</numero>
    <totvic>5</totvic>
    <totdef>0</totdef>
    <idequipe>EQ1</idequipe>
    <idclub>CL1</idclub>
    <vic>5</vic>
    <def>0</def>
    <nul>0</nul>
    <pf>0</pf>
    <pg>25</pg>
    <pp>0</pp>
  </classement>
</liste>`;

const CHPRENC_XML = `<?xml version="1.0"?>
<liste>
  <resultat>
    <equa>A</equa>
    <equb>B</equb>
    <resa>3</resa>
    <resb>0</resb>
  </resultat>
  <joueur>
    <xja>JA</xja>
    <xca>CA</xca>
    <xjb>JB</xjb>
    <xcb>CB</xcb>
  </joueur>
  <partie>
    <ja>JA</ja>
    <scorea>3</scorea>
    <jb>JB</jb>
    <scoreb>0</scoreb>
    <detail>11-5</detail>
  </partie>
</liste>`;

const JOUEURS_XML = `<?xml version="1.0"?>
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

const LICENCEB_XML = `<?xml version="1.0"?>
<liste>
  <licence>
    <idlicence>111</idlicence>
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

const PARTIES_XML = `<?xml version="1.0"?>
<liste>
  <partie>
    <licence>1234567A</licence>
    <advlic>7654321B</advlic>
    <vd>V</vd>
    <numjourn>1</numjourn>
    <codechamp>CH1</codechamp>
    <date>01/01/2024</date>
    <advsexe>M</advsexe>
    <advnompre>MARTIN</advnompre>
    <pointres>+3</pointres>
    <coefchamp>1.0</coefchamp>
    <advclaof>1200</advclaof>
  </partie>
</liste>`;

const HISTO_XML = `<?xml version="1.0"?>
<liste>
  <histo>
    <echelon>R</echelon>
    <place>1</place>
    <point>1500</point>
    <saison>2023-2024</saison>
    <phase>1</phase>
  </histo>
</liste>`;

const EPREUVES_XML = `<?xml version="1.0"?>
<liste>
  <epreuve>
    <idepreuve>EP1</idepreuve>
    <idorga>ORG1</idorga>
    <libelle>Champ</libelle>
    <typepreuve>E</typepreuve>
  </epreuve>
</liste>`;

const DIVISIONS_XML = `<?xml version="1.0"?>
<liste>
  <division>
    <iddivision>DIV1</iddivision>
    <libelle>R1</libelle>
  </division>
</liste>`;

const RESCLA_XML = `<?xml version="1.0"?>
<liste>
  <classement>
    <rang>1</rang>
    <nom>DUPONT Jean</nom>
    <clt>1500</clt>
    <club>USFTT</club>
    <points>150</points>
  </classement>
</liste>`;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getEquipes", () => {
  it("calls xml_equipe with numclu param", async () => {
    mockFetch.mockResolvedValue(EQUIPES_XML);

    const result = await getEquipes("07890123", APP_ID, SERIE, PASSWORD);

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_equipe",
      expect.objectContaining({ numclu: "07890123" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.libEquipe).toBe("USFTT 1");
  });

  it("passes optional type param", async () => {
    mockFetch.mockResolvedValue(EQUIPES_XML);

    await getEquipes("07890123", APP_ID, SERIE, PASSWORD, "1");

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_equipe",
      expect.objectContaining({ numclu: "07890123", type: "1" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
  });
});

describe("getResultEquMatches", () => {
  it("calls xml_result_equ without action param", async () => {
    mockFetch.mockResolvedValue(MATCHES_XML);

    const result = await getResultEquMatches("456", "123", APP_ID, SERIE, PASSWORD);

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_result_equ",
      expect.objectContaining({ D1: "456", cx_poule: "123" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
    expect(mockFetch).toHaveBeenCalledWith(
      "xml_result_equ",
      expect.not.objectContaining({ action: expect.anything() }),
      APP_ID,
      SERIE,
      PASSWORD
    );
    expect(result).toHaveLength(1);
  });
});

describe("getResultEquClassement", () => {
  it("calls xml_result_equ with action=classement", async () => {
    mockFetch.mockResolvedValue(CLASSEMENT_XML);

    await getResultEquClassement("456", "123", APP_ID, SERIE, PASSWORD);

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_result_equ",
      expect.objectContaining({ D1: "456", cx_poule: "123", action: "classement" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
  });
});

describe("getResultEquPoules", () => {
  it("calls xml_result_equ with action=poule", async () => {
    mockFetch.mockResolvedValue(MATCHES_XML);

    await getResultEquPoules("456", APP_ID, SERIE, PASSWORD);

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_result_equ",
      expect.objectContaining({ D1: "456", action: "poule" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
  });
});

describe("getChpRenc", () => {
  it("calls xml_chp_renc with lienParams", async () => {
    mockFetch.mockResolvedValue(CHPRENC_XML);

    const lienParams = { cx_poule: "123", D1: "456", renc_id: "789" };
    const result = await getChpRenc(lienParams, APP_ID, SERIE, PASSWORD);

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_chp_renc",
      expect.objectContaining({ cx_poule: "123", D1: "456", renc_id: "789" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
    expect(result.resultat.equa).toBe("A");
    expect(result.joueurs).toHaveLength(1);
    expect(result.parties).toHaveLength(1);
  });
});

describe("getJoueurs", () => {
  it("calls xml_liste_joueur with club param", async () => {
    mockFetch.mockResolvedValue(JOUEURS_XML);

    const result = await getJoueurs("07890123", APP_ID, SERIE, PASSWORD);

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_liste_joueur",
      expect.objectContaining({ club: "07890123" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
    expect(result).toHaveLength(1);
  });
});

describe("getLicenceB", () => {
  it("calls xml_licence_b with given params", async () => {
    mockFetch.mockResolvedValue(LICENCEB_XML);

    const result = await getLicenceB({ licence: "1234567A" }, APP_ID, SERIE, PASSWORD);

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_licence_b",
      expect.objectContaining({ licence: "1234567A" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
    expect(result).toHaveLength(1);
  });

  it("accepts club param instead of licence", async () => {
    mockFetch.mockResolvedValue(LICENCEB_XML);

    await getLicenceB({ club: "07890123" }, APP_ID, SERIE, PASSWORD);

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_licence_b",
      expect.objectContaining({ club: "07890123" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
  });
});

describe("getPartieMysql", () => {
  it("calls xml_partie_mysql with licence param", async () => {
    mockFetch.mockResolvedValue(PARTIES_XML);

    const result = await getPartieMysql("1234567A", APP_ID, SERIE, PASSWORD);

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_partie_mysql",
      expect.objectContaining({ licence: "1234567A" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
    expect(result).toHaveLength(1);
  });
});

describe("getHistoClassement", () => {
  it("calls xml_histo_classement with numlic param", async () => {
    mockFetch.mockResolvedValue(HISTO_XML);

    const result = await getHistoClassement("1234567A", APP_ID, SERIE, PASSWORD);

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_histo_classement",
      expect.objectContaining({ numlic: "1234567A" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
    expect(result).toHaveLength(1);
  });
});

describe("getEpreuves", () => {
  it("calls xml_epreuve with organisme and type params", async () => {
    mockFetch.mockResolvedValue(EPREUVES_XML);

    const result = await getEpreuves("ORG001", "E", APP_ID, SERIE, PASSWORD);

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_epreuve",
      expect.objectContaining({ organisme: "ORG001", type: "E" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
    expect(result).toHaveLength(1);
  });
});

describe("getDivisions", () => {
  it("calls xml_division with organisme, epreuve, and type params", async () => {
    mockFetch.mockResolvedValue(DIVISIONS_XML);

    const result = await getDivisions("ORG001", "EP001", "E", APP_ID, SERIE, PASSWORD);

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_division",
      expect.objectContaining({ organisme: "ORG001", epreuve: "EP001", type: "E" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
    expect(result).toHaveLength(1);
  });
});

describe("getResCla", () => {
  it("calls xml_res_cla with resDivision params", async () => {
    mockFetch.mockResolvedValue(RESCLA_XML);

    const result = await getResCla({ res_division: "DIV001" }, APP_ID, SERIE, PASSWORD);

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_res_cla",
      expect.objectContaining({ res_division: "DIV001" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
    expect(result).toHaveLength(1);
  });
});

const RESULT_INDIV_POULES_XML = `<?xml version="1.0"?>
<liste>
  <tour><libelle>T4 Gr1</libelle><lien>epr=15953&amp;res_division=196680&amp;cx_tableau=219834</lien><date>13/03/2026</date></tour>
</liste>`;

const RESULT_INDIV_CLASSEMENT_XML = `<?xml version="1.0"?>
<liste>
  <classement><rang>1</rang><nom>DUPONT</nom><clt>1500</clt><club>USFTT</club><points>120A</points></classement>
</liste>`;

const RESULT_INDIV_PARTIES_XML = `<?xml version="1.0"?>
<liste>
  <partie><libelle>Finale</libelle><vain>DUPONT</vain><perd>MARTIN</perd><forfait/></partie>
</liste>`;

describe("getResultIndivPoules", () => {
  it("calls xml_result_indiv with action=poule", async () => {
    mockFetch.mockResolvedValue(RESULT_INDIV_POULES_XML);

    const result = await getResultIndivPoules("15953", "196680", APP_ID, SERIE, PASSWORD);

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_result_indiv",
      expect.objectContaining({ action: "poule", epr: "15953", res_division: "196680" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.libelle).toBe("T4 Gr1");
  });
});

describe("getResultIndivClassement", () => {
  it("calls xml_result_indiv with action=classement", async () => {
    mockFetch.mockResolvedValue(RESULT_INDIV_CLASSEMENT_XML);

    const result = await getResultIndivClassement("15953", "196680", "219834", APP_ID, SERIE, PASSWORD);

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_result_indiv",
      expect.objectContaining({ action: "classement", epr: "15953", res_division: "196680", cx_tableau: "219834" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.nom).toBe("DUPONT");
  });
});

describe("getResultIndivParties", () => {
  it("calls xml_result_indiv with action=partie", async () => {
    mockFetch.mockResolvedValue(RESULT_INDIV_PARTIES_XML);

    const result = await getResultIndivParties("15953", "196680", "219834", APP_ID, SERIE, PASSWORD);

    expect(mockFetch).toHaveBeenCalledWith(
      "xml_result_indiv",
      expect.objectContaining({ action: "partie", epr: "15953", res_division: "196680", cx_tableau: "219834" }),
      APP_ID,
      SERIE,
      PASSWORD
    );
    expect(result).toHaveLength(1);
    expect(result[0]!.vain).toBe("DUPONT");
  });
});
