# Fakten-Quellen

Hier steht, woher die Fakten im Spiel kommen. Die Links sind nur für Erwachsene.
Im Spiel selbst gibt es keine Links (Jugendschutz).

## Fische nach Uhrzeit (`zeit` in `FISH`)

Im Spiel: `zeit:'nacht'` = 16–6 Uhr, `'tag'` = 6–18 Uhr, `'daemmerung'` = 5–9 und 16–21 Uhr (`ZEIT_FENSTER`).
Fische ohne `zeit` beißen immer. `zeit` steht nur dort, wo es in der Natur stimmt.
Die Belege wurden beim Einbau gesammelt (Stand Oktober 2026). Die Spalte „Beleg“ ist aus dem Arbeitsbericht übernommen (englisch).

| Fisch | zeit | Beleg |
|---|---|---|
| Aal (*Anguilla anguilla*) | nacht | FishBase fact file (via hebfauna.myspecies.info/vertebrates/anguilla-anguilla-european-eel): "nocturnal, inactive during the day, resting under rocks…". Telemetry studies agree that activity is mostly nocturnal: Poole Harbour (openpolar.no, doi 10.1002/aqc.2380) and the Belgian stream study (kmae-journal.org 2008). |
| Wels (*Silurus glanis*) | nacht | FishBase summary 289 (fishbase.se/summary/289): "nocturnal predator". Lake Constance telemetry (mdpi fishes 09 00280): vertical movement mostly in darkness. |
| Quappe (*Lota lota*) | nacht | Carl 1995, sonic tracking in Lake Opeongo (harkness.ca PDF): inactive in daylight, active from dusk to dawn. ADW (animaldiversity.org/accounts/Lota_lota): "crepuscular or nocturnal". The game's own fact text already says "nachts unterwegs". |
| Zander (*Sander lucioperca*) | nacht | Sächsisches Landesamt/Fischerei, Segelken-Voigt (fischerei.sachsen.de, Stand_der_Zanderaquakultur PDF): "dämmerungs- und nachtaktiv". This fits "abends und nachts". |
| Zitteraal (*Electrophorus electricus*) | nacht | Wikipedia "Electric eel" and ADW (animaldiversity.org/accounts/Electrophorus_electricus): "mostly nocturnal", poor eyesight, finds its way by electrolocation. |
| Antennenwels (*Pimelodus pictus*, the photo species) | nacht | Wikipedia "Pimelodus pictus": "like many catfish, nocturnal bottom feeders". Seriously Fish and FishProfiles also say nocturnal. These are mostly aquarium sources, but they agree. |
| Hecht (*Esox lucius*) | tag | Baktoft et al. 2012, year-round telemetry (orbit.dtu.dk "Seasonal and diel effects on the activity of northern pike…"): more active by day than by night in every period. Kobler et al., HU Berlin (agrar.hu-berlin.de): activity peaks at twilight in summer. He is a sight hunter. |
| Pfauenbarsch (*Cichla ocellaris*) | tag | Wikipedia "Peacock bass" (genus *Cichla*): "diurnal predatory fishes". |

### Ohne `zeit` (mit Grund)

- **Arowana** (*Osteoglossum bicirrhosum*): Nur ein Aquarien-Steckbrief (fishprofiles.com) sagt „tagaktiv“ (diurnal). Eine Zoo-Quelle (dwazoo.com)
  sagt, dass er Beute an der Oberfläche mit seinen Barteln „auch in völliger Dunkelheit“ findet. Keine Freiland-Studie zum Tagesrhythmus gefunden.
  Das ist nicht klar genug, darum ohne `zeit`.
- **Piraíba** (*Brachyplatystoma filamentosum*): Keine Quelle sagt, ob er tags oder nachts aktiv ist. Die Quellen beschreiben nur Lebensraum und
  Futter (aguasamazonicas.org, Wikipedia). Ein Angelführer aus Pará nennt den *Pirarara* nachtaktiv, das ist aber eine andere Art.
  „Welse sind oft nachtaktiv“ wurde nicht auf diese Art übertragen. Er beißt außerdem nur vom Boot aus.
- Gute Kandidaten für später: Barsch (tagaktiv) und Barbe (nacht- und dämmerungsaktiv). Noch nicht eingebaut.

## Infotafel „Regenzeit und Trockenzeit“ (`regenzeit`, Rio Negro bei Manaus)

Spieltext: Der Amazonas liegt nah am Äquator, die Tage sind immer ungefähr gleich lang. Bei Manaus regnet es vor allem
etwa von Dezember bis Mai. In der Regenzeit steigt der Fluss um viele Meter, höher als ein Haus.

Zahlen und Quellen (nur hier, nicht im Spiel):
- Regenzeit Manaus etwa Dezember–Mai, Trockenzeit etwa Juni–November (Ränder je nach Quelle verschieden, darum „etwa“, „vor allem“):
  https://www.rainforestcruises.com/guides/best-time-to-visit-manaus ,
  https://kupi.com/en/explore/brazil/manaus/weather ,
  UFAM-Studie „Verão e inverno amazônico“: https://tedehomologacao.ufam.edu.br/items/088869a9-db8e-44fa-9efd-38c677708031
- Tage gleich lang: Tageslänge in Manaus bleibt das ganze Jahr innerhalb von 18 Minuten um 12 Stunden:
  https://weatherspark.com/y/28814/Average-Weather-in-Manaus-Amazonas-Brazil-Year-Round
- „Steigt um viele Meter, höher als ein Haus“ (bewusst ohne Zahl): Pegel Rio Negro in Manaus Ende Juni/Anfang Juli fast 27 m, drei Monate später 13,9 m
  (AP, https://abcnews.go.com/International/wireStory/drought-dried-amazon-river-tributary-lowest-level-122-114506659 );
  Rekord 30,02 m (Juni 2021) gegenüber Tiefstwerten um 13 m (https://reliefweb.int/report/brazil/state-emergency-decreed-manaus-due-flooding ).
  Normaler Unterschied also deutlich über 10 m.
- Überfluteter Wald: steht schon auf der Tafel `regenwald` (gleicher Fakt).

Weitere Quellen (Pegel Rio Negro und Regenzeit), der Spieltext bleibt ohne Zahl:
- Pegel Rio Negro in Manaus (Hafen-Pegel, Station 14990000, Messung seit 1902, SGB/CPRM): Hochwasser meist um 27–30 m
  (Rekord 30,02 m 2021; 29,97 m 2012), Niedrigwasser meist um 16–18 m (SGB-Prognose 2025: 17,70–18,90 m; Warnstufe um 17 m).
  Also jedes Jahr etwa 10 m oder mehr Unterschied. Einen veröffentlichten Mittelwert „≈ 10 m“ habe ich in der Suche nicht wörtlich
  gefunden; die Zahl ist aus diesen Werten abgeleitet, darum steht im Spiel bewusst „um viele Meter, höher als ein Haus“.
  https://portalamazonia.com/meio-ambiente/cota-minima-rio-negro-manaus-2025/ ,
  SGB-SACE-Bulletin Amazonas: https://www.sgb.gov.br/sace/boletins/Amazonas/20180518_16-20180521%20-%20161213.pdf ,
  https://www.climatempo.com.br/noticia/2021/07/05/vazante-do-rio-negro-finalmente-se-consolida-em-manaus-0722
- Regenzeit Dezember–Mai nach den Daten der INMET-Station Manaus (82331): UFAM-Studie (Revista Geonorte) „período chuvoso de dezembro a maio,
  Maxima Januar–Mai, Minima Juni–Oktober“: https://www.periodicos.ufam.edu.br/index.php/revista-geonorte/article/download/13121/11556/49610 ;
  Vergleich der INMET-Normalen 1961–1990 / 1991–2007: https://revistas.ufpr.br/revistaabclima/article/view/50484 ;
  INMET-Monatsbilanz (Normal 1991–2020, z. B. August nur 56,1 mm, Trockenzeit):
  https://portal.inmet.gov.br/noticias/balan%C3%A7o-manaus-am-teve-chuva-abaixo-e-temperaturas-acima-da-m%C3%A9dia-em-agosto-2023

## Hochseefische (`home:'hochsee'`, offenes Meer vor Hafenhausen)

Gesammelt beim Einbau (Stand Oktober 2026). Keiner der drei Fische hat `zeit`: Für keinen wurde ein klarer Beleg gefunden,
ob er nur tags oder nur nachts beißt.

| Fisch | Spieltext | Belege |
|---|---|---|
| Köhler (*Pollachius virens*), id `seelachs` | Heißt im Laden Seelachs, ist aber kein Lachs, sondern ein Verwandter vom Dorsch. Schwimmt gern in Schwärmen. | EU-Datenbank der Handelsnamen, FAO-Code POK: in Deutschland „Seelachs“ und „Köhler“ (https://fish-commercial-names.ec.europa.eu/fish-names/species_de?sn=29500). Familie Dorsche (Gadidae): FishBase (https://www.fishbase.se/summary/1343). „Active, gregarious fish“ (gesellig, in Gruppen): FishBase und MarLIN (https://www.marlin.ac.uk/species/detail/84); Schwarmverhalten beobachtet vom norwegischen Meeresforschungsinstitut (https://imr.brage.unit.no/imr-xmlui/handle/11250/103903). Wie groß die Schwärme sind, ist nicht belegt, darum nur „in Schwärmen“. |
| Steinbutt (*Scophthalmus maximus*) | Plattfisch, rund wie ein Teller. Beide Augen links (bei der Scholle rechts). Passt seine Farbe dem Meeresboden an. | MarLIN (https://www.marlin.ac.uk/species/detail/1917): Augen auf der linken Seite, liegt auf der rechten Seite, kann die Farbe dem Untergrund anpassen. Mr Goodfish (https://www.mrgoodfish.com/en/species/turbot/): „left-eyed“, Färbung passt sich dem Boden an. FishBase (https://www.fishbase.se/summary/1348): „Body almost circular“, Augenseite ohne Schuppen, mit Knochenhöckern. Sea Angler (https://www.seaangler.co.uk/fishing-tips/species/know-your-fish-turbot/): „almost circular – resembling a large dinner plate“. Scholle (*Pleuronectes platessa*) gehört zu den rechtsäugigen Plattfischen (Pleuronectidae, „righteye flounders“): FishBase. |
| Thunfisch = Roter Thun (*Thunnus thynnus*), selten | Riese, schwimmt sehr schnell. Körper wärmer als das Wasser. War lange aus der Nordsee verschwunden, kommt langsam zurück. | Wärmer als das Wasser: Kent Wildlife Trust (https://kentwildlifetrust.org.uk/wildlife-explorer/marine/fish-including-sharks-skates-and-rays/atlantic-bluefin-tuna); Muskeln im Mittel 27,6 °C bei 18,9 °C Wassertemperatur (Studie im Mittelmeer, https://iris.unica.it/handle/11584/101262); Wärmetauscher im Blut: NOAA Fishery Bulletin 1975 (https://fisherybulletin.nmfs.noaa.gov/sites/default/files/pdf-content/1975/732/graham.pdf). Rückkehr: DTU Aqua (https://www.aqua.dtu.dk/english/newsarchive/2025/12/tuna-and-diet) und ICCAT-GBYP-Berichte von DTU/SLU (https://www.iccat.int/GBYP/DOCS/Tagging_Phase_10_DTU.pdf): fast sechs Jahrzehnte so gut wie weg, seit knapp zehn Jahren wieder in Skagerrak, Kattegat und Nordsee; bioRxiv-Preprint „Improved management facilitates return of an iconic fish species“ (https://www.biorxiv.org/content/10.1101/197780.full.pdf). Frühere Forschung in der Nordsee: Tiews 1957. Im Spiel ist er ein seltener Fisch (`RULES`, immer zurücksetzen), weil der Bestand sich gerade erst erholt. |

Größen im Spiel (`cm`) bewusst im üblichen Bereich, nicht beim Rekord: Köhler 40–90 cm, Steinbutt 30–70 cm, Roter Thun 100–250 cm
(er kann noch viel größer werden).

## Europa (v45): 5 Angelplätze im Ausland (`SPOTS` mit `land`, `LAENDER`)

Gesammelt beim Einbau (Stand November 2026). Geprüft über Suchergebnisse (WebSearch); viele Seiten selbst waren aus der
Entwicklungsumgebung nicht abrufbar. Darum vorsichtig formuliert („etwa“, „einer der größten“). Länder und Hauptstädte sind Allgemeinwissen
(Atlas); Bern ist offiziell „Bundesstadt“, das steht auch auf der Tafel.

**Grüße von Hannes** (`GRUSS`): „Grüezi“ (Deutschschweiz), „Goedendag“ (Niederländisch, „Guten Tag“), „Servus“ (Österreich, wie in Bayern),
„Jó napot“ (Ungarisch, kurz für „Jó napot kívánok“, „Guten Tag“), „Dobrý den“ (Tschechisch, „Guten Tag“). Allgemeines Sprachwissen.

### `ch-rhein` – Rhein am Rheinfall (Schweiz, Hauptstadt Bern)
| Fakt im Spiel | Beleg |
|---|---|
| Bern ist die Hauptstadt, die Schweizer sagen „Bundesstadt“ | swissinfo: „Warum die Schweiz keine Hauptstadt hat“ (https://www.swissinfo.ch/ger/ungewohnliche-schweiz/warum-die-schweiz-keine-hauptstadt-hat/89021621), Bundesstadt seit 1848 (https://www.swissinfo.ch/ger/geschichte_warum-bern-vor-170-jahren-hauptstadt-der-schweiz-wurde/44572964) |
| Rhein entspringt in den Alpen der Schweiz, fließt durch den Bodensee, dann nach Westen bis Basel, dort nach Norden | Skill `sachkunde-grundschule` (Quelle Graubünden); Hochrhein Bodensee–Basel, Rheinfall ganz auf Schweizer Gebiet: Lernhelfer „Schweizerische Eidgenossenschaft“ (https://www.lernhelfer.de/schuelerlexikon/geografie/artikel/schweizerische-eidgenossenschaft); Britannica „Rhine River“ (https://www.britannica.com/place/Rhine-River) |
| Rheinfall etwa 150 m breit, 23 m hoch, einer der größten Wasserfälle Europas | Historisches Lexikon der Schweiz (https://hls-dhs-dss.ch/de/articles/016145), Zürich Tourismus „Rheinfall – Der grösste Wasserfall Europas“ (https://www.zuerich.com/de/besuchen/natur/rheinfall), MySwitzerland (https://www.myswitzerland.com/de-at/erlebnisse/der-rheinfall/). „Größter“ gilt nur nach Breite und Wassermenge, darum im Spiel „einer der größten“. |
| Äschen leben hier, mögen kühles, schnell fließendes Wasser | BAFU, Fischaufstieg am Hochrhein: Strecke zwischen Kraftwerk Schaffhausen und Rheinfall ist wichtiges Laichgebiet und Larvenhabitat der Äsche (https://www.bafu.admin.ch/dam/de/sd-web/FXwEOKWm6xoe/fischaufstieg_amhochrhein.pdf); SRF Kids zur Äsche im Rhein (https://www.srf.ch/kids/srf-kids-in-der-schule-vom-aussterben-bedroht-ueberlebt-die-aesche-im-rhein) |
| Fische: Äsche, Forelle, Barbe, Döbel, Nase, Hecht, Barsch, Rotauge | Kanton Aargau, Hochrhein: historisch Barbe, Nase, Äsche; Status-Tabelle mit Alet (Döbel), Äsche, Bachforelle, Barbe (https://www.ag.ch/umwelt-aargau/pdf/UAG_43_33.pdf); IKSR-Bericht: am Hochrhein dominieren Rotauge, Brachsen, Döbel, Flussbarsch; Rückgang von Äsche und Nase (https://www.iksr.org/fileadmin/user_upload/DKDM/Dokumente/Fachberichte/DE/rp_De_0279.pdf); Angelportal Rhein bei Schaffhausen: Barbe, Hecht, Döbel (https://www.alleangeln.de/gewaesser/rhein-schaffhausen). Kein Aal: der Rheinfall ist für Wanderfische ein Hindernis. |

### `nl-rhein` – Lek bei Kinderdijk (Niederlande, Hauptstadt Amsterdam)
| Fakt im Spiel | Beleg |
|---|---|
| Etwa ein Viertel des Landes liegt tiefer als das Meer, Deiche schützen es | Planet Wissen „Niederlande“ (https://www.planet-wissen.de/kultur/westeuropa/niederlande_land_und_leute/index.html), fluter (https://www.fluter.de/sites/default/files/aqua_planning.pdf). Angaben schwanken zwischen einem Viertel und knapp einem Drittel, darum „etwa ein Viertel“. |
| Der Rhein teilt sich in mehrere Arme (Waal, Nederrijn/Lek, IJssel); der Lek fließt zur Nordsee | bpb „Das Tor zur Welt“ (https://www.bpb.de/themen/europaeische-geschichte/geschichte-im-fluss/135700/das-tor-zur-welt); IKSR „Delta Rhein“ (https://www.iksr.org/en/topics/rhine/sub-basins/delta-rhine); Wikipedia „Lek (river)“ (https://en.wikipedia.org/wiki/Lek_(river)) |
| In Kinderdijk stehen 19 alte Windmühlen, fast 300 Jahre alt (gebaut 1738 und 1740); sie pumpten das Wasser aus den Poldern in große Speicherbecken (Boezems), von dort floss es in den Lek; UNESCO-Welterbe seit 1997 | kinderdijk.com „Windmills & pumps“ (https://kinderdijk.com/about-kinderdijk/story/windmills-pumps) und „Kinderdijk history“ (https://kinderdijk.com/about-kinderdijk/story/kinderdijk-history); Wikipedia „Kinderdijk windmills“ (https://en.wikipedia.org/wiki/Kinderdijk_windmills), National Geographic (https://www.nationalgeographic.com/travel/article/holland-kinderdijk-windmills-unesco-world-heritage-site), Austria-Forum „Kinderdijk“ (https://austria-forum.org/af/AustriaWiki/Kinderdijk) |
| Fische: Brachse, Zander, Aal, Rotauge, Barsch, Hecht, Karpfen | WUR/Rijkswaterstaat „Vismonitoring Rijkswateren t/m 2020“: im Unterlauf dominieren Blankvoorn (Rotauge), Brasem (Brachse), Snoekbaars (Zander); Baars (Barsch) nimmt zu; Karper unter den zehn häufigsten Arten; Snoek (Hecht) in pflanzenreichen Seitengewässern (https://edepot.wur.nl/558192, https://open.rijkswaterstaat.nl/publish/pages/113507/vismonitor_rijkswateren_tm_2020_deel_i_toestand_en_trends_dl_2.pdf); Paling (Aal) mit Reusen überwacht, auch im Lek (https://open.rijkswaterstaat.nl/publish/pages/94997/jaarrapportage_passieve_vismonitoring_zoete_rijkswateren-fuik-en_zalmsteekregistraties_in_2010.pdf); Kinderstuben für Flussfische in Nederrijn und Lek (https://open.rijkswaterstaat.nl/publish/pages/37568/kraamkamers_voor_riviervissen_in_de_uiterwaardwateren_in_de_nederrijn_en_lek.pdf) |

### `at-donau` – Donau in Wien (Österreich, Hauptstadt Wien)
| Fakt im Spiel | Beleg |
|---|---|
| Wien ist Hauptstadt und größte Stadt Österreichs | Allgemeinwissen (Atlas) |
| Donau kommt aus Deutschland, hinter Passau nach Österreich, von Wien weiter nach Osten in die Slowakei und nach Ungarn | Skill `sachkunde-grundschule` (Donau, 10 Länder); Britannica „Danube River“ (https://www.britannica.com/place/Danube-River) |
| Riesenrad im Prater, über 120 Jahre alt (eröffnet 1897), etwa 65 m hoch (64,75 m) | Austria-Forum „Wiener Riesenrad“ (https://austria-forum.org/af/AustriaWiki/Wiener_Riesenrad), austria.info (https://www.austria.info/de-at/locations/riesenrad/), wien.info Fun Facts (https://www.wien.info/de/sehen-erleben/prater/riesenrad-fun-facts-356718) |
| Barben und Nasen mögen schnell fließendes Wasser | „Im Hauptstrom dominieren die klassischen Flußfischarten (Barbe, Nase, Hasel …)“: Nationalpark Donau-Auen (https://infothek.donauauen.at/files/3_GeschichteNPDA/32_GeschichteNPDAabErricht/321_GeschichteNPDAGmbHMedien/3211_Managementplaene/32111_NOEManagementplaene/03_00580_vonaalbiszander_1999.pdf); NÖ „Vorkommen flusstypischer Fischarten“ (https://www.noe.gv.at/noe/Wasser/Vorkommen_flusstypischer_Fischarten.pdf) |
| Fische: Barbe, Nase, Zander, Wels, Rapfen, Brachse, Döbel, Hecht, Karpfen | Wiener Fischereimanagementplan Nationalpark Donau-Auen 2022–2028 (Fangbeschränkungen für Karpfen, Zander, Hecht, Wels, Schied = Rapfen; Schonzeiten Barbe, Brachse) (https://www.ris.bka.gv.at/Dokumente/Gemeinderecht/GEMRE_WI_90101_L490_020_2022/GEMRE_WI_90101_L490_020_2022.pdf); Stadt Wien, Laichhilfen Wienfluss 2023 (Aitel = Döbel, Zander, Wels) (https://www.wien.gv.at/spezial/studien/ma45/laichhilfenwienfluss2023.pdf); „Von Aal bis Zander“ (Link oben) |

### `hu-donau` – Donau in Budapest (Ungarn, Hauptstadt Budapest)
| Fakt im Spiel | Beleg |
|---|---|
| Budapest entstand 1873 aus mehreren Städten (Buda, Óbuda, Pest); Buda am Westufer, Pest am Ostufer | Britannica „Budapest“ (https://www.britannica.com/place/Budapest/The-modern-city), Austria-Forum „Budapest“ (https://austria-forum.org/af/AustriaWiki/Budapest), bpb „Ein Fluss und seine Stadt“ (https://www.bpb.de/themen/europaeische-geschichte/geschichte-im-fluss/159502/ein-fluss-und-seine-stadt/) |
| Donau kommt aus Österreich und der Slowakei, fließt durch Budapest, dann nach Süden und bis ins Schwarze Meer | Britannica „Danube River“ (Link oben); bpb (Link oben) |
| Parlament in Pest direkt an der Donau, etwa 268 m lang, Kuppel 96 m hoch | Parlamentsbibliothek „House of Parliament“ (https://konyvtar.parlament.hu/web/visitors/house-of-parliament), Structurae (https://structurae.net/de/bauwerke/parlamentsgebaeude-budapest), Wikipedia „Hungarian Parliament Building“ (https://en.wikipedia.org/wiki/Hungarian_Parliament_Building) |
| Fische: Wels, Zander, Karpfen, Brachse, Rapfen, Barbe, Hecht | Hungaricana (ungarischer Donauabschnitt, typisch: Sterlet, Karpfen, Hecht, Wels, Barbe, Brachse) (https://library.hungaricana.hu/en/view/VACV_Sk_04/?pg=19); Angelführer Budapest: Karpfen, Hecht, Rapfen, Wels, Zander, Brachse (https://fishingbooker.com/destinations/location/hu/budapest); ungarische Besatzzahlen 2023 für Zander, Wels, Hecht, Rapfen, Barbe, Karpfen (https://halaszat.kormany.hu/akadalymentes/download/2/5a/73000/Cikk%202024%20Halászat%20téli%20szám_végleges.pdf) |

### `cz-moldau` – Moldau in Prag (Tschechien, Hauptstadt Prag)
| Fakt im Spiel | Beleg |
|---|---|
| Prag liegt an der Moldau, nicht an der Elbe | Spec „Europa freischalten“, VisitCzechia (https://www.visitczechia.com/de-de/news/2025/05/n-year-of-the-vltava-river) |
| Moldau längster Fluss Tschechiens (etwa 430 km), entspringt im Böhmerwald, fließt nach Norden, mündet bei Mělník in die Elbe; Elbe fließt weiter nach Deutschland | Britannica „Vltava River“ (https://www.britannica.com/place/Vltava-River), Wikipedia „Vltava“ (https://en.wikipedia.org/wiki/Vltava), bpb „Deutscher Fluss, tschechischer Fluss“ (https://www.bpb.de/themen/europaeische-geschichte/geschichte-im-fluss/160210/deutscher-fluss-tschechischer-fluss/); Skill `sachkunde-grundschule` (Elbe) |
| Karlsbrücke: alte Steinbrücke, Bau ab 1357 unter Kaiser Karl IV. (fertig 1402), 30 Figuren (Heiligenstatuen), Brückentürme an beiden Enden | prague.eu „Karlsbrücke“ (https://www.prague.eu/de/objekt/orte/93/karlsbrucke), VisitCzechia „Karlsbrücke und Brückentürme“ (https://www.visitczechia.com/de-DE/things-to-do/places/landmarks/urban-architecture/c-prague-charles-bridge-and-bridge-towers), Britannica „Charles Bridge“ (https://www.britannica.com/place/Charles-Bridge) |
| Fische: Karpfen, Wels, Zander, Hecht, Döbel, Brachse, Barbe, Rotauge, Barsch | Pražský deník (Angler in Prag: Karpfen, Schleie, Zander, Wels, Hecht) (https://prazsky.denik.cz/zpravy-region/rybar20090417/); Studie zur Kormoran-Nahrung an der Moldau: Rotauge, Brachse, Döbel, Barsch (https://bioone.org/journals/folia-zoologica/volume-60/issue-2/fozo.v60.i2.a7.2011/Winter-diet-of-great-cormorant-Phalacrocorax-carbo-on-the-River/10.25225/fozo.v60.i2.a7.2011.full); Fishbrain Moldau / Mündung der Berounka in Prag: Karpfen, Rotauge, Barsch, Brachse, Barbe (https://fishbrain.com/fishing-waters/JOJeYj3t/vltava, https://fishbrain.com/fishing-waters/SdTCrqHO/soutok-berounky-a-vltavy); Živa „Ichtyofauna pražských vod“ (https://www.ziva.avcr.cz/files/ziva/pdf/ichtyofauna-prazskych-vod-a-jeji-zmeny.pdf) |

**Wahrzeichen in 3D** (`LOOKS`): vereinfacht und kleiner als in echt (Riesenrad, Parlament, Brückentürme). Auf dem großen Felsen im Rheinfall
weht in echt eine Schweizer Fahne (Schwäbische Zeitung „Der Rheinfall ist alles andere als ein Reinfall“, https://www.schwaebische.de/panorama/der-rheinfall-ist-alles-andere-als-ein-reinfall-349278); im Spiel auch. Für den Fluss-Stempel gibt es an jedem Platz mindestens drei häufige Fische
(z. B. Rotauge, Barsch, Barbe, Brachse, Döbel, Karpfen).

### Europa-Karte (`EUMAP`, `showEuropa`)
| Was auf der Karte | Beleg |
|---|---|
| Grenzen der Länder (Deutschland, Schweiz, Niederlande, Österreich, Ungarn, Tschechien und Nachbarländer) | Natural Earth, „Admin 0 – Countries“ 1:50m (`ne_50m_admin_0_countries.geojson`), gemeinfrei (https://www.naturalearthdata.com/about/terms-of-use/), GitHub-Spiegel `nvkelso/natural-earth-vector` (Ordner `geojson`) |
| Flüsse Rhein (mit Waal, Nederrijn und Lek bis zur Nordsee), Donau, Elbe, Moldau | Natural Earth „Rivers + lake centerlines“ 1:10m (`ne_10m_rivers_lake_centerlines.geojson`; 1:50m hat keine Moldau/Vltava), gemeinfrei |
| Seen: Bodensee, Genfer See, Balaton, IJsselmeer | Natural Earth „Lakes + Reservoirs“ 1:50m (`ne_50m_lakes.geojson`), gemeinfrei |
| Hauptstädte Berlin, Bern, Amsterdam, Wien, Budapest, Prag (Lage gerundet) | Allgemeinwissen (Atlas); Bern als Bundesstadt siehe `ch-rhein` oben |

Vorbereitet im November 2026 mit einem kleinen Python-Skript (nicht im Repo): Ausschnitt Länge 2,5–23,5 und Breite 45–55,5,
Projektion wie bei der Deutschland-Karte (gleichabständig, Länge mal cos(50,25°)), 48 Pixel pro Breitengrad (645 × 504 Pixel),
auf ganze Pixel gerundet und vereinfacht (Douglas-Peucker, 0,6 Pixel; Seen 0,3 Pixel). Nichts wird zur Laufzeit geladen.
