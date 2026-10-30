# Herkunft der 3D-Menschen (menschen.bin)

`menschen.bin` entsteht mit `node tools/menschen-bauen.js <Ordner>` aus diesen Quellen:

- **MakeHuman / MPFB2**: Grundnetz, Formziele, Skelett und Gewichte.
  CC0 1.0 (gemeinfrei). https://github.com/makehumancommunity/mpfb2
- **MakeHuman-Systemteile**: Hautbilder, Augen, Brauen, Wimpern und die
  Frisuren short01–short04 und afro01. CC0 1.0.
- **Frisur culturalibre_hair_02** (Autor: culturalibre): CC0 1.0.
  http://www.makehumancommunity.org/node/2892

Aufbereitet hat diese Daten das Projekt humanforge
(https://github.com/abdulrehman043/humanforge). Seine Daten stehen unter
CC0, sein Laufzeitcode unter der MIT-Lizenz. Das Bauwerkzeug liest das
Paketformat nach dessen Vorbild; dafür gilt:

> MIT License — Copyright (c) 2026 humanforge contributors
>
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all
> copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
> AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
> OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
> SOFTWARE.

Trikot, Hose, Stutzen und Schuhe sind keine fremden Teile: Das Bauwerkzeug
schneidet sie aus der Haut des Menschen selbst.

# Herkunft der Bewegungen (bewegungen.json)

`bewegungen.json` entsteht mit `node tools/bewegungen-bauen.js <Ordner>` aus
Aufnahmen der **Carnegie Mellon University Motion Capture Database**
(http://mocap.cs.cmu.edu), in der BVH-Fassung von Bruce Hahne, gespiegelt unter
https://github.com/meshula/cmu-mocap (Ordner `data/`). Verwendet werden die
Aufnahmen 09_01 (Laufen), 16_35 (Traben), 16_15 (Gehen), 10_02 (Stehen),
10_03 (Schuss), 11_01 (Pass) und 13_39 (Sprung).

> The data used in this project was obtained from mocap.cs.cmu.edu.
> The database was created with funding from NSF EIA-0196217.

CMU stellt die Daten ohne Einschränkung frei, auch für kommerzielle Projekte
("This data is free for use in research and commercial projects worldwide");
die BVH-Fassung fügt keine Einschränkung hinzu.
