# Woher die Skills kommen

Skills sind Anleitungen für Claude: Wissen zum Spiele-Bauen, das Claude bei Bedarf nachliest.
Alle Skills hier sind unverändert kopiert, nur `sachkunde-grundschule` ist für dieses Spiel selbst geschrieben. Die Lizenz liegt in jedem Ordner (`LICENSE`, bei Apache auch `NOTICE`).
Wichtig: Die Regeln in `CLAUDE.md` gelten immer zuerst.

| Skill | Wofür | Quelle | Lizenz |
|---|---|---|---|
| threejs-debug-profiler | Fehler finden, Spiel schneller machen (auch iPad) | [majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills) @ `8286774` | MIT |
| threejs-game-ui-designer | Knöpfe, Anzeigen, Menüs, Touch | majidmanzarpour/threejs-game-skills @ `8286774` | MIT |
| game-feel | Dass sich Fangen und Tippen gut anfühlt | [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) @ `0a70cfc` | Apache-2.0 |
| game-ui-ux | Menüs und Bildschirme planen | gamedev-skills/awesome-gamedev-agent-skills @ `0a70cfc` | Apache-2.0 |
| camera-systems | Kamera, die weich hinterherfliegt | gamedev-skills/awesome-gamedev-agent-skills @ `0a70cfc` | Apache-2.0 |
| input-systems | Steuerung mit Finger und Tastatur | gamedev-skills/awesome-gamedev-agent-skills @ `0a70cfc` | Apache-2.0 |
| performance-optimization | Spiel flüssig halten | gamedev-skills/awesome-gamedev-agent-skills @ `0a70cfc` | Apache-2.0 |
| procedural-gen | Welt per Zufall bauen (Bäume, Seerosen, Fisch-Seltenheit) | gamedev-skills/awesome-gamedev-agent-skills @ `0a70cfc` | Apache-2.0 |
| save-systems | Spielstand speichern, alte Spielstände weiter laden | gamedev-skills/awesome-gamedev-agent-skills @ `0a70cfc` | Apache-2.0 |
| threejs-fundamentals | Three.js Grundlagen | [CloudAI-X/threejs-skills](https://github.com/CloudAI-X/threejs-skills) @ `11ffda7` | MIT |
| threejs-geometry | 3D-Formen bauen | CloudAI-X/threejs-skills @ `11ffda7` | MIT |
| threejs-materials | Oberflächen und Farben | CloudAI-X/threejs-skills @ `11ffda7` | MIT |
| threejs-lighting | Licht und Schatten | CloudAI-X/threejs-skills @ `11ffda7` | MIT |
| threejs-animation | Bewegung (Fische, Schwimmer, Wellen) | CloudAI-X/threejs-skills @ `11ffda7` | MIT |
| threejs-textures | Bilder auf 3D-Formen (z. B. Fischfotos) | CloudAI-X/threejs-skills @ `11ffda7` | MIT |
| sachkunde-grundschule | Sachkunde 3./4. Klasse: Karten, Deutschland, Bundesländer, Flüsse, Fische (geprüfte Fakten) | selbst geschrieben für dieses Spiel, nach dem Bildungsplan BW 2016 (Quellen stehen im Skill) | eigener Text |

## Bewusst weggelassen
- Bild-, Ton- und 3D-Generatoren: brauchen bezahlte Zugänge, und die Bilder wären nicht frei lizenziert.
- Skills für Unity, Godot, Unreal, Roblox: andere Spiele-Programme.
- Kampf-, Überlebens- und Gegner-Skills: passen nicht zu „ab 7 Jahren“.
- Skills, die npm, Vite oder TypeScript verlangen: unser Spiel ist eine einzige `index.html`.
