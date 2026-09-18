/**
 * Echte Vereine für alle Ligen der Spielwelt
 *
 * Bisher war nur die Bundesliga mit echten Vereinen besetzt; alle übrigen elf
 * Ligen wurden vom ClubGenerator aus Städtenamen und Namensbausteinen
 * zusammengesetzt. Dabei entstanden Gebilde wie "Annecy Stade", "Crewe
 * Rangers", "Real Cesena" oder "Atalanta Avellino" - Namen, die aussehen wie
 * Fußball, aber keiner sind. Wer in der Premier League gegen "AFC Bolton
 * Rovers" spielt, weiß nie, ob das ein Spitzenklub ist.
 *
 * Diese Datei hinterlegt für jede Liga die echten Vereine mit Stadt, Stadion
 * und Fassungsvermögen. Die Reihenfolge ist die Rangfolge: Der erste Verein
 * einer Liste ist der stärkste, der letzte der schwächste. Der ClubGenerator
 * leitet daraus Ruf, Etat und Erwartungshaltung ab - genau wie vorher, nur
 * eben für echte Vereine.
 *
 * Zum Stand: Die Ligen der Stufen 1 bis 3 (die fünf großen Erstligen sowie
 * 2. Bundesliga und 3. Liga) entsprechen der Zusammensetzung der Saison
 * 2024/25. Ab der Regionalliga abwärts wechselt die Zugehörigkeit zu einer
 * bestimmten Staffel jede Saison; dort stehen echte Vereine, die auf oder
 * nahe dieser Ebene spielen - nicht die Staffeleinteilung eines bestimmten
 * Jahres.
 *
 * Fehlt für eine Liga ein Eintrag oder reicht die Liste nicht, füllt der
 * ClubGenerator wie bisher mit erzeugten Vereinen auf.
 */

const REAL_CLUBS_BY_LEAGUE = {

    // ---------------------------------------------------------- England
    en_liga_1: [
        { id: "en_mci", name: "Manchester City", city: "Manchester", stadium: "Etihad Stadium", capacity: 53400 },
        { id: "en_liv", name: "Liverpool FC", city: "Liverpool", stadium: "Anfield", capacity: 61276 },
        { id: "en_ars", name: "Arsenal FC", city: "London", stadium: "Emirates Stadium", capacity: 60704 },
        { id: "en_mun", name: "Manchester United", city: "Manchester", stadium: "Old Trafford", capacity: 74310 },
        { id: "en_che", name: "Chelsea FC", city: "London", stadium: "Stamford Bridge", capacity: 40343 },
        { id: "en_tot", name: "Tottenham Hotspur", city: "London", stadium: "Tottenham Hotspur Stadium", capacity: 62850 },
        { id: "en_new", name: "Newcastle United", city: "Newcastle", stadium: "St James' Park", capacity: 52305 },
        { id: "en_avl", name: "Aston Villa", city: "Birmingham", stadium: "Villa Park", capacity: 42682 },
        { id: "en_whu", name: "West Ham United", city: "London", stadium: "London Stadium", capacity: 62500 },
        { id: "en_eve", name: "FC Everton", city: "Liverpool", stadium: "Goodison Park", capacity: 39414 },
        { id: "en_bha", name: "Brighton & Hove Albion", city: "Brighton", stadium: "Amex Stadium", capacity: 31800 },
        { id: "en_cry", name: "Crystal Palace", city: "London", stadium: "Selhurst Park", capacity: 25486 },
        { id: "en_ful", name: "FC Fulham", city: "London", stadium: "Craven Cottage", capacity: 29589 },
        { id: "en_wol", name: "Wolverhampton Wanderers", city: "Wolverhampton", stadium: "Molineux", capacity: 31750 },
        { id: "en_nfo", name: "Nottingham Forest", city: "Nottingham", stadium: "City Ground", capacity: 30404 },
        { id: "en_bre", name: "FC Brentford", city: "London", stadium: "Gtech Community Stadium", capacity: 17250 },
        { id: "en_lei", name: "Leicester City", city: "Leicester", stadium: "King Power Stadium", capacity: 32261 },
        { id: "en_bou", name: "AFC Bournemouth", city: "Bournemouth", stadium: "Vitality Stadium", capacity: 11307 },
        { id: "en_sou", name: "FC Southampton", city: "Southampton", stadium: "St Mary's Stadium", capacity: 32384 },
        { id: "en_ips", name: "Ipswich Town", city: "Ipswich", stadium: "Portman Road", capacity: 30311 }
    ],

    // ---------------------------------------------------------- Spanien
    es_liga_1: [
        { id: "es_rma", name: "Real Madrid", city: "Madrid", stadium: "Santiago Bernabéu", capacity: 78297 },
        { id: "es_fcb", name: "FC Barcelona", city: "Barcelona", stadium: "Spotify Camp Nou", capacity: 99354 },
        { id: "es_atm", name: "Atlético Madrid", city: "Madrid", stadium: "Riyadh Air Metropolitano", capacity: 70460 },
        { id: "es_ath", name: "Athletic Bilbao", city: "Bilbao", stadium: "San Mamés", capacity: 53289 },
        { id: "es_sev", name: "FC Sevilla", city: "Sevilla", stadium: "Ramón Sánchez-Pizjuán", capacity: 43883 },
        { id: "es_rso", name: "Real Sociedad", city: "San Sebastián", stadium: "Reale Arena", capacity: 39500 },
        { id: "es_bet", name: "Real Betis", city: "Sevilla", stadium: "Benito Villamarín", capacity: 60720 },
        { id: "es_vil", name: "FC Villarreal", city: "Villarreal", stadium: "Estadio de la Cerámica", capacity: 23500 },
        { id: "es_val", name: "FC Valencia", city: "Valencia", stadium: "Mestalla", capacity: 49430 },
        { id: "es_cel", name: "Celta Vigo", city: "Vigo", stadium: "Balaídos", capacity: 29000 },
        { id: "es_gir", name: "FC Girona", city: "Girona", stadium: "Montilivi", capacity: 14624 },
        { id: "es_osa", name: "CA Osasuna", city: "Pamplona", stadium: "El Sadar", capacity: 23576 },
        { id: "es_esp", name: "RCD Espanyol", city: "Barcelona", stadium: "RCDE Stadium", capacity: 40000 },
        { id: "es_ray", name: "Rayo Vallecano", city: "Madrid", stadium: "Estadio de Vallecas", capacity: 14708 },
        { id: "es_mll", name: "RCD Mallorca", city: "Palma", stadium: "Son Moix", capacity: 23142 },
        { id: "es_get", name: "FC Getafe", city: "Getafe", stadium: "Coliseum", capacity: 17393 },
        { id: "es_ala", name: "Deportivo Alavés", city: "Vitoria", stadium: "Mendizorroza", capacity: 19840 },
        { id: "es_lpa", name: "UD Las Palmas", city: "Las Palmas", stadium: "Gran Canaria", capacity: 32400 },
        { id: "es_leg", name: "CD Leganés", city: "Leganés", stadium: "Butarque", capacity: 12450 },
        { id: "es_vll", name: "Real Valladolid", city: "Valladolid", stadium: "José Zorrilla", capacity: 27618 }
    ],

    // ---------------------------------------------------------- Italien
    it_liga_1: [
        { id: "it_int", name: "Inter Mailand", city: "Milano", stadium: "Giuseppe Meazza", capacity: 75923 },
        { id: "it_mil", name: "AC Mailand", city: "Milano", stadium: "Giuseppe Meazza", capacity: 75923 },
        { id: "it_juv", name: "Juventus Turin", city: "Torino", stadium: "Allianz Stadium", capacity: 41507 },
        { id: "it_nap", name: "SSC Neapel", city: "Napoli", stadium: "Diego Armando Maradona", capacity: 54726 },
        { id: "it_rom", name: "AS Rom", city: "Roma", stadium: "Stadio Olimpico", capacity: 70634 },
        { id: "it_ata", name: "Atalanta Bergamo", city: "Bergamo", stadium: "Gewiss Stadium", capacity: 24950 },
        { id: "it_laz", name: "Lazio Rom", city: "Roma", stadium: "Stadio Olimpico", capacity: 70634 },
        { id: "it_fio", name: "AC Florenz", city: "Firenze", stadium: "Artemio Franchi", capacity: 43147 },
        { id: "it_bol", name: "FC Bologna", city: "Bologna", stadium: "Renato Dall'Ara", capacity: 38279 },
        { id: "it_tor", name: "FC Turin", city: "Torino", stadium: "Olimpico Grande Torino", capacity: 28177 },
        { id: "it_udi", name: "Udinese Calcio", city: "Udine", stadium: "Bluenergy Stadium", capacity: 25144 },
        { id: "it_gen", name: "CFC Genua", city: "Genova", stadium: "Luigi Ferraris", capacity: 33205 },
        { id: "it_cag", name: "Cagliari Calcio", city: "Cagliari", stadium: "Unipol Domus", capacity: 16416 },
        { id: "it_ver", name: "Hellas Verona", city: "Verona", stadium: "Marcantonio Bentegodi", capacity: 39211 },
        { id: "it_lec", name: "US Lecce", city: "Lecce", stadium: "Via del Mare", capacity: 31533 },
        { id: "it_par", name: "Parma Calcio", city: "Parma", stadium: "Ennio Tardini", capacity: 22352 },
        { id: "it_emp", name: "FC Empoli", city: "Empoli", stadium: "Carlo Castellani", capacity: 16284 },
        { id: "it_com", name: "Como 1907", city: "Como", stadium: "Giuseppe Sinigaglia", capacity: 13602 },
        { id: "it_mon", name: "AC Monza", city: "Monza", stadium: "U-Power Stadium", capacity: 15039 },
        { id: "it_ven", name: "FC Venedig", city: "Venezia", stadium: "Pier Luigi Penzo", capacity: 11150 }
    ],

    // -------------------------------------------------------- Frankreich
    fr_liga_1: [
        { id: "fr_psg", name: "Paris Saint-Germain", city: "Paris", stadium: "Parc des Princes", capacity: 47929 },
        { id: "fr_mon", name: "AS Monaco", city: "Monaco", stadium: "Stade Louis II", capacity: 18523 },
        { id: "fr_mar", name: "Olympique Marseille", city: "Marseille", stadium: "Stade Vélodrome", capacity: 67394 },
        { id: "fr_lil", name: "LOSC Lille", city: "Lille", stadium: "Stade Pierre-Mauroy", capacity: 50186 },
        { id: "fr_lyo", name: "Olympique Lyon", city: "Lyon", stadium: "Groupama Stadium", capacity: 59186 },
        { id: "fr_nic", name: "OGC Nizza", city: "Nice", stadium: "Allianz Riviera", capacity: 35624 },
        { id: "fr_len", name: "RC Lens", city: "Lens", stadium: "Stade Bollaert-Delelis", capacity: 38058 },
        { id: "fr_ren", name: "Stade Rennes", city: "Rennes", stadium: "Roazhon Park", capacity: 29778 },
        { id: "fr_bre", name: "Stade Brest", city: "Brest", stadium: "Stade Francis-Le Blé", capacity: 15220 },
        { id: "fr_str", name: "RC Strasbourg", city: "Strasbourg", stadium: "Stade de la Meinau", capacity: 26109 },
        { id: "fr_tou", name: "FC Toulouse", city: "Toulouse", stadium: "Stadium de Toulouse", capacity: 33150 },
        { id: "fr_rei", name: "Stade Reims", city: "Reims", stadium: "Stade Auguste-Delaune", capacity: 21684 },
        { id: "fr_nan", name: "FC Nantes", city: "Nantes", stadium: "Stade de la Beaujoire", capacity: 35322 },
        { id: "fr_aux", name: "AJ Auxerre", city: "Auxerre", stadium: "Stade Abbé-Deschamps", capacity: 21379 },
        { id: "fr_ang", name: "Angers SCO", city: "Angers", stadium: "Stade Raymond Kopa", capacity: 18752 },
        { id: "fr_lehav", name: "Le Havre AC", city: "Le Havre", stadium: "Stade Océane", capacity: 25178 },
        { id: "fr_ste", name: "AS Saint-Étienne", city: "Saint-Étienne", stadium: "Stade Geoffroy-Guichard", capacity: 41965 },
        { id: "fr_mtp", name: "Montpellier HSC", city: "Montpellier", stadium: "Stade de la Mosson", capacity: 32900 }
    ],

    // --------------------------------------------------- 2. Bundesliga
    // Ohne die Vereine, die in dieser Spielwelt schon erstklassig sind
    // (Hamburger SV, Schalke 04, 1. FC Köln, VfL Bochum).
    de_liga_2: [
        { id: "de2_h96", name: "Hannover 96", city: "Hannover", stadium: "Heinz-von-Heiden-Arena", capacity: 49000 },
        { id: "de2_her", name: "Hertha BSC", city: "Berlin", stadium: "Olympiastadion", capacity: 74667 },
        { id: "de2_f95", name: "Fortuna Düsseldorf", city: "Düsseldorf", stadium: "Merkur Spiel-Arena", capacity: 54600 },
        { id: "de2_fck", name: "1. FC Kaiserslautern", city: "Kaiserslautern", stadium: "Fritz-Walter-Stadion", capacity: 49780 },
        { id: "de2_stp", name: "FC St. Pauli", city: "Hamburg", stadium: "Millerntor-Stadion", capacity: 29546 },
        { id: "de2_fcn", name: "1. FC Nürnberg", city: "Nürnberg", stadium: "Max-Morlock-Stadion", capacity: 50000 },
        { id: "de2_ksc", name: "Karlsruher SC", city: "Karlsruhe", stadium: "Wildparkstadion", capacity: 34302 },
        { id: "de2_dsc", name: "Arminia Bielefeld", city: "Bielefeld", stadium: "SchücoArena", capacity: 26515 },
        { id: "de2_fcm", name: "1. FC Magdeburg", city: "Magdeburg", stadium: "MDCC-Arena", capacity: 30098 },
        { id: "de2_eint", name: "Eintracht Braunschweig", city: "Braunschweig", stadium: "Eintracht-Stadion", capacity: 23325 },
        { id: "de2_d98", name: "SV Darmstadt 98", city: "Darmstadt", stadium: "Merck-Stadion am Böllenfalltor", capacity: 17810 },
        { id: "de2_ksv", name: "Holstein Kiel", city: "Kiel", stadium: "Holstein-Stadion", capacity: 15034 },
        { id: "de2_scp", name: "SC Paderborn 07", city: "Paderborn", stadium: "Home Deluxe Arena", capacity: 15000 },
        { id: "de2_sgf", name: "SpVgg Greuther Fürth", city: "Fürth", stadium: "Sportpark Ronhof", capacity: 16626 },
        { id: "de2_vfl", name: "VfL Osnabrück", city: "Osnabrück", stadium: "Bremer Brücke", capacity: 15741 },
        { id: "de2_ssv", name: "Jahn Regensburg", city: "Regensburg", stadium: "Jahnstadion Regensburg", capacity: 15210 },
        { id: "de2_elv", name: "SV Elversberg", city: "Elversberg", stadium: "Ursapharm-Arena an der Kaiserlinde", capacity: 10000 },
        { id: "de2_ulm", name: "SSV Ulm 1846", city: "Ulm", stadium: "Donaustadion", capacity: 17000 }
    ],

    // -------------------------------------------------------- 3. Liga
    de_liga_3: [
        { id: "de3_sgd", name: "Dynamo Dresden", city: "Dresden", stadium: "Rudolf-Harbig-Stadion", capacity: 32066 },
        { id: "de3_han", name: "Hansa Rostock", city: "Rostock", stadium: "Ostseestadion", capacity: 29000 },
        { id: "de3_rwe", name: "Rot-Weiss Essen", city: "Essen", stadium: "Stadion an der Hafenstraße", capacity: 20650 },
        { id: "de3_ala", name: "Alemannia Aachen", city: "Aachen", stadium: "Tivoli", capacity: 32960 },
        { id: "de3_1860", name: "TSV 1860 München", city: "München", stadium: "Städtisches Stadion an der Grünwalder Straße", capacity: 15000 },
        { id: "de3_fcs", name: "1. FC Saarbrücken", city: "Saarbrücken", stadium: "Ludwigsparkstadion", capacity: 16003 },
        { id: "de3_cot", name: "Energie Cottbus", city: "Cottbus", stadium: "Stadion der Freundschaft", capacity: 22528 },
        { id: "de3_aue", name: "Erzgebirge Aue", city: "Aue", stadium: "Erzgebirgsstadion", capacity: 16485 },
        { id: "de3_wal", name: "SV Waldhof Mannheim", city: "Mannheim", stadium: "Carl-Benz-Stadion", capacity: 25667 },
        { id: "de3_fci", name: "FC Ingolstadt 04", city: "Ingolstadt", stadium: "Audi-Sportpark", capacity: 15800 },
        { id: "de3_swv", name: "SV Wehen Wiesbaden", city: "Wiesbaden", stadium: "BRITA-Arena", capacity: 12566 },
        { id: "de3_hfc", name: "Hallescher FC", city: "Halle", stadium: "Leuna-Chemie-Stadion", capacity: 15057 },
        { id: "de3_svs", name: "SV Sandhausen", city: "Sandhausen", stadium: "BWT-Stadion am Hardtwald", capacity: 15414 },
        { id: "de3_vik", name: "FC Viktoria Köln", city: "Köln", stadium: "Sportpark Höhenberg", capacity: 8343 },
        { id: "de3_spvu", name: "SpVgg Unterhaching", city: "Unterhaching", stadium: "Uhlsport Park", capacity: 15053 },
        { id: "de3_ver", name: "SC Verl", city: "Verl", stadium: "Sportclub Arena", capacity: 5153 },
        { id: "de3_fsv", name: "FSV Zwickau", city: "Zwickau", stadium: "GGZ-Arena", capacity: 10134 },
        { id: "de3_bvb2", name: "Borussia Dortmund II", city: "Dortmund", stadium: "Stadion Rote Erde", capacity: 9999 },
        { id: "de3_vfb2", name: "VfB Stuttgart II", city: "Stuttgart", stadium: "GAZi-Stadion auf der Waldau", capacity: 11000 },
        { id: "de3_hav", name: "TSV Havelse", city: "Garbsen", stadium: "Wilhelm-Langrehr-Stadion", capacity: 4000 }
    ],

    // ------------------------------------------------- Regionalliga West
    de_rl_west: [
        { id: "rlw_msv", name: "MSV Duisburg", city: "Duisburg", stadium: "Schauinsland-Reisen-Arena", capacity: 31500 },
        { id: "rlw_rwo", name: "Rot-Weiß Oberhausen", city: "Oberhausen", stadium: "Stadion Niederrhein", capacity: 21318 },
        { id: "rlw_wsv", name: "Wuppertaler SV", city: "Wuppertal", stadium: "Stadion am Zoo", capacity: 23000 },
        { id: "rlw_sfs", name: "Sportfreunde Siegen", city: "Siegen", stadium: "Leimbachstadion", capacity: 18200 },
        { id: "rlw_fko", name: "SC Fortuna Köln", city: "Köln", stadium: "Südstadion", capacity: 11748 },
        { id: "rlw_roed", name: "SV Rödinghausen", city: "Rödinghausen", stadium: "Häcker Wiehenstadion", capacity: 5027 },
        { id: "rlw_boc", name: "1. FC Bocholt", city: "Bocholt", stadium: "Stadion am Hünting", capacity: 7000 },
        { id: "rlw_lot", name: "Sportfreunde Lotte", city: "Lotte", stadium: "Frimo-Stadion", capacity: 10059 },
        { id: "rlw_gue", name: "FC Gütersloh", city: "Gütersloh", stadium: "Heidewaldstadion", capacity: 6500 },
        { id: "rlw_wie", name: "SC Wiedenbrück", city: "Rheda-Wiedenbrück", stadium: "Jahnstadion", capacity: 5004 },
        { id: "rlw_bmg2", name: "Borussia Mönchengladbach II", city: "Mönchengladbach", stadium: "Grenzlandstadion", capacity: 8000 },
        { id: "rlw_koe2", name: "1. FC Köln II", city: "Köln", stadium: "Franz-Kremer-Stadion", capacity: 5000 },
        { id: "rlw_f95_2", name: "Fortuna Düsseldorf II", city: "Düsseldorf", stadium: "Paul-Janes-Stadion", capacity: 7000 },
        { id: "rlw_bgl", name: "SV Bergisch Gladbach 09", city: "Bergisch Gladbach", stadium: "Stadion Bergisch Gladbach", capacity: 6000 },
        { id: "rlw_rhe", name: "FC Eintracht Rheine", city: "Rheine", stadium: "Jahnstadion Rheine", capacity: 5000 },
        { id: "rlw_sche", name: "SV Schermbeck", city: "Schermbeck", stadium: "Volksbank-Stadion", capacity: 3500 },
        { id: "rlw_scp2", name: "SC Paderborn 07 II", city: "Paderborn", stadium: "Hermann-Löns-Stadion", capacity: 3000 },
        { id: "rlw_boev", name: "TuS Bövinghausen", city: "Dortmund", stadium: "Sportplatz Bövinghausen", capacity: 2000 }
    ],

    // ----------------------------------------------- Regionalliga Bayern
    de_rl_bayern: [
        { id: "rlb_wkr", name: "Würzburger Kickers", city: "Würzburg", stadium: "FLYERALARM Arena", capacity: 13090 },
        { id: "rlb_sw05", name: "1. FC Schweinfurt 05", city: "Schweinfurt", stadium: "Willy-Sachs-Stadion", capacity: 15060 },
        { id: "rlb_bay", name: "SpVgg Bayreuth", city: "Bayreuth", stadium: "Hans-Walter-Wild-Stadion", capacity: 21500 },
        { id: "rlb_bur", name: "SV Wacker Burghausen", city: "Burghausen", stadium: "Wacker-Arena", capacity: 12200 },
        { id: "rlb_fcb2", name: "FC Bayern München II", city: "München", stadium: "FC Bayern Campus", capacity: 2500 },
        { id: "rlb_tg", name: "Türkgücü München", city: "München", stadium: "Sportpark Heimstetten", capacity: 2500 },
        { id: "rlb_ill", name: "FV Illertissen", city: "Illertissen", stadium: "Vöhlinstadion", capacity: 4500 },
        { id: "rlb_mem", name: "FC Memmingen", city: "Memmingen", stadium: "BBB-Arena", capacity: 4000 },
        { id: "rlb_fca2", name: "FC Augsburg II", city: "Augsburg", stadium: "Paul-Renz-Stadion", capacity: 3000 },
        { id: "rlb_fcn2", name: "1. FC Nürnberg II", city: "Nürnberg", stadium: "Sportpark Valznerweiher", capacity: 3000 },
        { id: "rlb_aub", name: "TSV Aubstadt", city: "Aubstadt", stadium: "Sportpark Aubstadt", capacity: 2500 },
        { id: "rlb_buch", name: "TSV Buchbach", city: "Buchbach", stadium: "Sportpark Buchbach", capacity: 3000 },
        { id: "rlb_vil", name: "DJK Vilzing", city: "Cham", stadium: "Sportpark Vilzing", capacity: 3000 },
        { id: "rlb_eic", name: "VfB Eichstätt", city: "Eichstätt", stadium: "Sportzentrum Eichstätt", capacity: 2000 },
        { id: "rlb_ans", name: "SpVgg Ansbach", city: "Ansbach", stadium: "Stadion am Schleifweg", capacity: 3000 },
        { id: "rlb_hei", name: "SV Heimstetten", city: "Kirchheim", stadium: "Sportpark Heimstetten", capacity: 2500 },
        { id: "rlb_rai", name: "TSV Rain am Lech", city: "Rain", stadium: "Georg-Weber-Stadion", capacity: 2000 },
        { id: "rlb_don", name: "SV Donaustauf", city: "Donaustauf", stadium: "Sportanlage Donaustauf", capacity: 2000 }
    ],

    // -------------------------------------------------------- Oberliga Nord
    de_ol_nord: [
        { id: "oln_vfb", name: "VfB Oldenburg", city: "Oldenburg", stadium: "Marschwegstadion", capacity: 15200 },
        { id: "oln_wei", name: "SC Weiche Flensburg 08", city: "Flensburg", stadium: "Manfred-Werner-Stadion", capacity: 3000 },
        { id: "oln_nor", name: "Eintracht Norderstedt", city: "Norderstedt", stadium: "Edmund-Plambeck-Stadion", capacity: 5000 },
        { id: "oln_alt", name: "Altona 93", city: "Hamburg", stadium: "Adolf-Jäger-Kampfbahn", capacity: 6000 },
        { id: "oln_hsv2", name: "Hamburger SV II", city: "Hamburg", stadium: "Volkspark-Nebenplatz", capacity: 2500 },
        { id: "oln_atl", name: "SV Atlas Delmenhorst", city: "Delmenhorst", stadium: "Stadion an der Düsternortstraße", capacity: 5000 },
        { id: "oln_teu", name: "FC Teutonia 05 Ottensen", city: "Hamburg", stadium: "Sportplatz Kreuzkirche", capacity: 2000 },
        { id: "oln_bsv", name: "BSV Rehden", city: "Rehden", stadium: "Waldsportstätten", capacity: 3000 },
        { id: "oln_hil", name: "VfV Borussia Hildesheim", city: "Hildesheim", stadium: "Friedrich-Ebert-Stadion", capacity: 5000 },
        { id: "oln_bre", name: "Bremer SV", city: "Bremen", stadium: "Panzenberg", capacity: 5000 },
        { id: "oln_dro", name: "SV Drochtersen/Assel", city: "Drochtersen", stadium: "Kehdinger Stadion", capacity: 3000 },
        { id: "oln_loh", name: "Blau-Weiß Lohne", city: "Lohne", stadium: "Städtisches Stadion", capacity: 3000 },
        { id: "oln_jed", name: "SSV Jeddeloh", city: "Edewecht", stadium: "Jeddeloher Sportpark", capacity: 2000 },
        { id: "oln_hei", name: "Heider SV", city: "Heide", stadium: "Jahn-Sportpark", capacity: 2500 },
        { id: "oln_obe", name: "FC Oberneuland", city: "Bremen", stadium: "Sportanlage Oberneuland", capacity: 3000 },
        { id: "oln_lup", name: "Lupo Martini Wolfsburg", city: "Wolfsburg", stadium: "Sportanlage Elsterweg", capacity: 2000 }
    ],

    // -------------------------------------------------------- Verbandsliga
    de_vl_1: [
        { id: "vl_gie", name: "FC Gießen", city: "Gießen", stadium: "Waldstadion Gießen", capacity: 10000 },
        { id: "vl_sta", name: "Eintracht Stadtallendorf", city: "Stadtallendorf", stadium: "Herrenwald-Stadion", capacity: 4000 },
        { id: "vl_dre", name: "SC Hessen Dreieich", city: "Dreieich", stadium: "Sportpark Dreieich", capacity: 4000 },
        { id: "vl_alz", name: "FC Bayern Alzenau", city: "Alzenau", stadium: "Sportpark Prischoß", capacity: 4000 },
        { id: "vl_wal", name: "SC Waldgirmes", city: "Lahnau", stadium: "Sportpark Waldgirmes", capacity: 2500 },
        { id: "vl_had", name: "SV Rot-Weiß Hadamar", city: "Hadamar", stadium: "Sportzentrum Hadamar", capacity: 2500 },
        { id: "vl_gin", name: "VfB Ginsheim", city: "Ginsheim-Gustavsburg", stadium: "Mainstadion", capacity: 3000 },
        { id: "vl_ros", name: "SG Rosenhöhe Offenbach", city: "Offenbach", stadium: "Sportanlage Rosenhöhe", capacity: 3000 },
        { id: "vl_fli", name: "SV Buchonia Flieden", city: "Flieden", stadium: "Sportgelände Flieden", capacity: 2000 },
        { id: "vl_leh", name: "TSV Lehnerz", city: "Fulda", stadium: "Sportplatz Lehnerz", capacity: 2000 },
        { id: "vl_fer", name: "FSV Fernwald", city: "Fernwald", stadium: "Sportanlage Fernwald", capacity: 2000 },
        { id: "vl_die", name: "TuS Dietkirchen", city: "Limburg", stadium: "Sportplatz Dietkirchen", capacity: 2000 },
        { id: "vl_ede", name: "FC Ederbergland", city: "Battenberg", stadium: "Sportplatz Battenberg", capacity: 2000 },
        { id: "vl_edd", name: "FC Eddersheim", city: "Hattersheim", stadium: "Sportanlage Eddersheim", capacity: 2500 },
        { id: "vl_erl", name: "SV Erlensee", city: "Erlensee", stadium: "Sportpark Erlensee", capacity: 2000 },
        { id: "vl_bue", name: "SKV Büttelborn", city: "Büttelborn", stadium: "Sportanlage Büttelborn", capacity: 2000 }
    ],

    // ---------------------------------------------------------- Landesliga
    de_ll_1: [
        { id: "ll_han", name: "FC Hanau 93", city: "Hanau", stadium: "Herbert-Dröse-Stadion", capacity: 5000 },
        { id: "ll_vil", name: "FV Bad Vilbel", city: "Bad Vilbel", stadium: "Sportpark Bad Vilbel", capacity: 3000 },
        { id: "ll_iso", name: "SpVgg Neu-Isenburg", city: "Neu-Isenburg", stadium: "Sportpark Neu-Isenburg", capacity: 2500 },
        { id: "ll_wie", name: "SV Wiesbaden", city: "Wiesbaden", stadium: "Sportpark Rheinhöhe", capacity: 3000 },
        { id: "ll_bru", name: "SG Bruchköbel", city: "Bruchköbel", stadium: "Sportzentrum Bruchköbel", capacity: 2000 },
        { id: "ll_ber", name: "SV Bernbach", city: "Freigericht", stadium: "Sportanlage Bernbach", capacity: 2000 },
        { id: "ll_kel", name: "Viktoria Kelsterbach", city: "Kelsterbach", stadium: "Sportanlage Kelsterbach", capacity: 2000 },
        { id: "ll_spr", name: "SKG Sprendlingen", city: "Dreieich", stadium: "Sportanlage Sprendlingen", capacity: 2000 },
        { id: "ll_zei", name: "SV Zeilsheim", city: "Frankfurt", stadium: "Sportanlage Zeilsheim", capacity: 2000 },
        { id: "ll_unt", name: "VfB Unterliederbach", city: "Frankfurt", stadium: "Sportanlage Unterliederbach", capacity: 2000 },
        { id: "ll_rie", name: "SG Riedrode", city: "Bürstadt", stadium: "Sportanlage Riedrode", capacity: 2000 },
        { id: "ll_obe", name: "SV Croatia Obertshausen", city: "Obertshausen", stadium: "Sportanlage Obertshausen", capacity: 2000 },
        { id: "ll_ege", name: "SG Egelsbach", city: "Egelsbach", stadium: "Sportanlage Egelsbach", capacity: 2000 },
        { id: "ll_woe", name: "TSG Wörsdorf", city: "Idstein", stadium: "Sportanlage Wörsdorf", capacity: 1500 },
        { id: "ll_hoe", name: "TSV Höchst", city: "Höchst im Odenwald", stadium: "Sportgelände Höchst", capacity: 1500 },
        { id: "ll_kal", name: "FC Kalbach", city: "Frankfurt", stadium: "Sportanlage Kalbach", capacity: 1500 }
    ]
};

if (typeof window !== "undefined") {
    window.REAL_CLUBS_BY_LEAGUE = REAL_CLUBS_BY_LEAGUE;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { REAL_CLUBS_BY_LEAGUE };
}
