# Luxusyacht und offenes Meer – Design

Idee von Felix (23.10.2026), Plan mit Papa abgestimmt („ja passt“).

## Ziel
In Hafenhausen gibt es am Hafen einen Bootshändler. Dort kauft man eine **Luxusyacht für 20.000 Ludins**.
Mit ihr fährt man durch den Hafen aufs **offene Meer**. Dort gibt es eine Sandbank mit Seehunden, Bojen, Wellen,
eine kleine Insel und 3 große Meeresfische. Vom Deck aus kann man angeln.

Für Felix ist es fertig, wenn er die Yacht kaufen, aus dem Hafen hinausfahren, an der Insel anlegen, Robben sehen
und draußen einen großen Fisch fangen kann. Und wenn nach dem Neuladen alles noch da ist.

## Gesagt (von Felix)
- Kaufen bei einem **neuen Bootshändler am Hafen**.
- Können: im Hafen fahren, von der Yacht angeln, aufs offene Meer, Luxus an Bord.
- Aussehen: **schwarz mit Gold**.
- Meer: Sandbank mit Robben, neue große Meeresfische, Bojen und Wellen, eine kleine Insel.
- Preis: 20.000 Ludins.

## Annahmen (von Claude, im Plan bestätigt)
- Die Yacht ist ein **Fahrzeug auf dem Wasser**. Sie nutzt die vorhandene Fahr-Logik
  (`player.ride`, Einsteigen und Aussteigen, Kontext-Knopf). Dabei gilt `ride==='luxus'`.
  Sie ist **kein** Eintrag in `VEHICLE_IDS`, also kein Parken auf der Straße und kein Abschleppdienst.
- Die Yacht fährt nur auf tiefem Wasser in der Stadt und auf dem Meer: `luxusWater(x,z)` = `heightAt < -1` und nicht an Stegen.
  Sie ist lang. Wie beim Cyber-Truck müssen Bug und Heck frei sein (`luxusFits`).
- **Liegeplätze** (`LUXUS_BERTHS`): `hafen` (Steg im Hafenbecken, beim Bootshändler) und `insel` (Steg an der Insel).
  Einsteigen geht nur an einem Liegeplatz, an dem die Yacht liegt. Aussteigen geht nur in der Nähe eines Liegeplatzes.
  Danach liegt die Yacht dort.
- Fahren von der Yacht wie beim Truck: Sie hält an Hindernissen an und rutscht nicht. Wenn sie hängt, kommt ein Tipp.
- Luxus an Bord:
  - Sonnendeck mit kleinem Pool (blaue Fläche);
  - goldener Name des Avatars am Rumpf (wie bei der Amazonas-Yacht);
  - eigene Hupe: tiefer Ton, Knopf „📯 Hupe“ wie beim Truck, gleiche Knopf-Logik.
- Kein Logo, keine Marke.

## Welt
- **Offenes Meer** (`SEA`): beginnt südlich der Hafeneinfahrt, etwa x −300 … 300 und z −3150 … −3650.
  `cityHeight` liefert dort tiefes Wasser (−4), außer auf Sandbank und Insel.
- Die Wasserfläche muss das ganze Meer abdecken. Ist die vorhandene Fläche zu schmal (240 m), bekommt das Meer eine eigene Fläche.
- **Wellen**: Die Yacht schaukelt sanft, wie das Boot am Amazonas, und die Meeresfläche bewegt sich leicht. Kein starkes Wackeln (Game Feel sanft).
- **Bojen**: rote Bojen links, grüne rechts (so ist es in Deutschland). Sie stehen an der Fahrrinne aus dem Hafen und sind Hindernisse.
- **Sandbank** (`SANDBANK`): flache, sandfarbene Fläche über Wasser mit 4–6 Seehunden.
  - Sie liegen und heben ab und zu den Kopf.
  - Kommt die Yacht näher als 25 m, hebt einer den Kopf, und es kommt einmal (höchstens alle 20 s) der Hinweis:
    „Abstand halten! Die Seehunde ruhen sich aus.“
  - Die Sandbank ist für die Yacht ein Hindernis, sie ist zu flach.
- **Insel** (`ISLAND`): rund, etwa 40 m groß, mit Strand, Gras, ein paar Bäumen, einem kleinen Leuchtturm (`lighthouse`) und einem Steg (Liegeplatz `insel`).
  Zu Fuß kann man auf der Insel herumlaufen.
- Die Stadt wird nur einmal gebaut (`buildCity`). Das Meer wird mit ihr gebaut, aber **nach** allen Zufallszahlen der Häuser (eigene `rng`).
  Was sich bewegt (Robben-Köpfe, Yacht, Wellen), kommt **nach** `bakeCells`.

## Fische
- 3 neue Fische mit `home:'hochsee'`. Sie beißen nur auf dem offenen Meer (`atSea()`), egal ob von der Yacht oder von der Insel:
  - **Thunfisch** (Roter Thun): selten, wird immer zurückgesetzt (`RULES` mit `selten`);
  - **Seelachs** (Köhler);
  - **Steinbutt**.
- Auf dem offenen Meer beißen auch die 5 Hafenfische, aber seltener. Im Hafen beißen nur die 5 Hafenfische.
- Vom Deck der Yacht aus beißen große Fische (`price>=40`) öfter, wie beim Boot.
- Echte Fotos von lebenden Fischen von Wikimedia Commons, mit Eintrag in `fotos/BILDNACHWEIS.md` und `FOTOS`. Die Fakten werden geprüft.
- Im Fischbuch gibt es einen neuen Teil „Offenes Meer“.

## Spielstand
- Neue Felder in `state.city` mit Startwert: `luxus:false` und `yachtAt:'hafen'`.
  Die Prüfung beim Laden repariert falsche Werte: `luxus` muss boolean sein, `yachtAt` muss in `LUXUS_BERTHS` stehen.
- `riding:'luxus'` beim Speichern bedeutet: `where` ist der Steg des Liegeplatzes, an dem die Yacht zuletzt lag oder dem sie am nächsten ist.
  `riding` wird `''`. Nach dem Neuladen steht man zu Fuß am Steg. Nie im Wasser.
- `SAVE_VERSION` bleibt 2. Kein Feld wird gelöscht. Die Schlüssel bleiben gleich.

## Bootshändler
- Ein Laden „Bootshafen“ an der Kaimauer neben dem Hafen-Steg, mit Kontext-Knopf „⛵ Zum Bootshafen“.
- Eine Karte mit der Luxusyacht (20.000 L), gebaut über `buyList`. Ist sie gekauft, steht dort „Hast du“, und der Text sagt, wo sie liegt.
- Auf dem Stadtplan sind der Bootshafen und die Yacht eingezeichnet. Die große Karte zeigt auch das Meer, Insel und Sandbank.

## Fehlerfälle
- Zu wenig Ludins: Der Knopf ist grau und zeigt „Noch X L“.
- Aussteigen auf dem offenen Meer: Es gibt keinen Knopf. Der Tipp sagt: „Fahr zu einem Steg, um auszusteigen.“
- Fliegen oder Werkstatt öffnen, während man auf der Yacht ist: Die Yacht legt am nächsten Liegeplatz an, und man steht dort.
- Die Straßenbahn, die Fahrzeuge und der Abschleppdienst ändern sich nicht.

## Tests
- Yacht kaufen: Die Ludins stimmen, `city.luxus` ist true, und das bleibt nach dem Neuladen so.
- Einsteigen im Hafen, aus dem Hafen hinausfahren (W halten), danach ist `atSea`.
- An der Insel aussteigen: `yachtAt` ist `insel`. Nach dem Neuladen steht man auf der Insel und die Yacht liegt dort.
- Speichern während der Fahrt: Nach dem Neuladen steht man zu Fuß an einem Steg.
- Draußen angeln: Es beißen nur Meeres- oder Hochseefische.
- Alter oder kaputter Spielstand: `luxus` und `yachtAt` werden repariert.
- Zu wenig Ludins: Der Kauf geht nicht.

## Neu-Seite
v31 „Luxusyacht“ mit 1–2 kindgerechten Sätzen.

## Nicht dabei (später vielleicht)
Wetter, Sturm, Tauchen, weitere Inseln, Delfine.
