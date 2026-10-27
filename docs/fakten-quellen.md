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
