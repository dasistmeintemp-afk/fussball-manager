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
 * Zum Stand: Die fünf großen Erstligen, die zweiten Ligen aller Länder und
 * die 3. Liga entsprechen der Zusammensetzung der Saison 2024/25. In den
 * dritten Ligen Englands (League One, ebenfalls 2024/25), Spaniens,
 * Italiens und Frankreichs sowie ab der Regionalliga abwärts wechselt die Zugehörigkeit zu einer
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

    // ------------------------------------------- England, Stufen 2 und 3
    // Championship und League One in der Zusammensetzung 2024/25
    en_liga_2: [
        { id: "en2_lee", name: "Leeds United", city: "Leeds", stadium: "Elland Road", capacity: 37645 },
        { id: "en2_bur", name: "FC Burnley", city: "Burnley", stadium: "Turf Moor", capacity: 21944 },
        { id: "en2_shu", name: "Sheffield United", city: "Sheffield", stadium: "Bramall Lane", capacity: 32050 },
        { id: "en2_sun", name: "AFC Sunderland", city: "Sunderland", stadium: "Stadium of Light", capacity: 49000 },
        { id: "en2_mid", name: "FC Middlesbrough", city: "Middlesbrough", stadium: "Riverside Stadium", capacity: 34742 },
        { id: "en2_cov", name: "Coventry City", city: "Coventry", stadium: "Coventry Building Society Arena", capacity: 32609 },
        { id: "en2_wba", name: "West Bromwich Albion", city: "West Bromwich", stadium: "The Hawthorns", capacity: 26850 },
        { id: "en2_bri", name: "Bristol City", city: "Bristol", stadium: "Ashton Gate", capacity: 27000 },
        { id: "en2_nor", name: "Norwich City", city: "Norwich", stadium: "Carrow Road", capacity: 27359 },
        { id: "en2_wat", name: "FC Watford", city: "Watford", stadium: "Vicarage Road", capacity: 22200 },
        { id: "en2_swa", name: "Swansea City", city: "Swansea", stadium: "Swansea.com Stadium", capacity: 21088 },
        { id: "en2_mil", name: "FC Millwall", city: "London", stadium: "The Den", capacity: 20146 },
        { id: "en2_bla", name: "Blackburn Rovers", city: "Blackburn", stadium: "Ewood Park", capacity: 31367 },
        { id: "en2_shw", name: "Sheffield Wednesday", city: "Sheffield", stadium: "Hillsborough", capacity: 39732 },
        { id: "en2_sto", name: "Stoke City", city: "Stoke-on-Trent", stadium: "bet365 Stadium", capacity: 30089 },
        { id: "en2_qpr", name: "Queens Park Rangers", city: "London", stadium: "Loftus Road", capacity: 18439 },
        { id: "en2_hul", name: "Hull City", city: "Hull", stadium: "MKM Stadium", capacity: 25586 },
        { id: "en2_pre", name: "Preston North End", city: "Preston", stadium: "Deepdale", capacity: 23404 },
        { id: "en2_der", name: "Derby County", city: "Derby", stadium: "Pride Park", capacity: 32956 },
        { id: "en2_por", name: "FC Portsmouth", city: "Portsmouth", stadium: "Fratton Park", capacity: 20688 },
        { id: "en2_oxf", name: "Oxford United", city: "Oxford", stadium: "Kassam Stadium", capacity: 12500 },
        { id: "en2_lut", name: "Luton Town", city: "Luton", stadium: "Kenilworth Road", capacity: 12000 },
        { id: "en2_ply", name: "Plymouth Argyle", city: "Plymouth", stadium: "Home Park", capacity: 17900 },
        { id: "en2_car", name: "Cardiff City", city: "Cardiff", stadium: "Cardiff City Stadium", capacity: 33280 }
    ],

    en_liga_3: [
        { id: "en3_bir", name: "Birmingham City", city: "Birmingham", stadium: "St Andrew's", capacity: 29409 },
        { id: "en3_wre", name: "AFC Wrexham", city: "Wrexham", stadium: "Racecourse Ground", capacity: 12600 },
        { id: "en3_sto", name: "Stockport County", city: "Stockport", stadium: "Edgeley Park", capacity: 10852 },
        { id: "en3_cha", name: "Charlton Athletic", city: "London", stadium: "The Valley", capacity: 27111 },
        { id: "en3_wyc", name: "Wycombe Wanderers", city: "High Wycombe", stadium: "Adams Park", capacity: 9448 },
        { id: "en3_ley", name: "Leyton Orient", city: "London", stadium: "Brisbane Road", capacity: 9271 },
        { id: "en3_rea", name: "FC Reading", city: "Reading", stadium: "Select Car Leasing Stadium", capacity: 24161 },
        { id: "en3_bol", name: "Bolton Wanderers", city: "Bolton", stadium: "Toughsheet Community Stadium", capacity: 28723 },
        { id: "en3_bpl", name: "FC Blackpool", city: "Blackpool", stadium: "Bloomfield Road", capacity: 16616 },
        { id: "en3_hud", name: "Huddersfield Town", city: "Huddersfield", stadium: "John Smith's Stadium", capacity: 24121 },
        { id: "en3_lin", name: "Lincoln City", city: "Lincoln", stadium: "Sincil Bank", capacity: 10780 },
        { id: "en3_bar", name: "FC Barnsley", city: "Barnsley", stadium: "Oakwell", capacity: 23287 },
        { id: "en3_rot", name: "Rotherham United", city: "Rotherham", stadium: "New York Stadium", capacity: 12021 },
        { id: "en3_ste", name: "FC Stevenage", city: "Stevenage", stadium: "Lamex Stadium", capacity: 7800 },
        { id: "en3_wig", name: "Wigan Athletic", city: "Wigan", stadium: "Brick Community Stadium", capacity: 25138 },
        { id: "en3_exe", name: "Exeter City", city: "Exeter", stadium: "St James Park", capacity: 8696 },
        { id: "en3_man", name: "Mansfield Town", city: "Mansfield", stadium: "Field Mill", capacity: 9186 },
        { id: "en3_pet", name: "Peterborough United", city: "Peterborough", stadium: "Weston Homes Stadium", capacity: 15314 },
        { id: "en3_nor", name: "Northampton Town", city: "Northampton", stadium: "Sixfields Stadium", capacity: 7724 },
        { id: "en3_bur", name: "Burton Albion", city: "Burton upon Trent", stadium: "Pirelli Stadium", capacity: 6912 },
        { id: "en3_cra", name: "Crawley Town", city: "Crawley", stadium: "Broadfield Stadium", capacity: 6134 },
        { id: "en3_brr", name: "Bristol Rovers", city: "Bristol", stadium: "Memorial Stadium", capacity: 9832 },
        { id: "en3_cam", name: "Cambridge United", city: "Cambridge", stadium: "Abbey Stadium", capacity: 8127 },
        { id: "en3_shr", name: "Shrewsbury Town", city: "Shrewsbury", stadium: "New Meadow", capacity: 9875 }
    ],

    // ------------------------------------------- Spanien, Stufen 2 und 3
    // Segunda División 2024/25; in der dritten Liga, der Primera Federación,
    // stehen Vereine, die auf oder nahe dieser Ebene spielen
    es_liga_2: [
        { id: "es2_lev", name: "UD Levante", city: "Valencia", stadium: "Ciutat de València", capacity: 26354 },
        { id: "es2_elc", name: "FC Elche", city: "Elche", stadium: "Martínez Valero", capacity: 31388 },
        { id: "es2_ovi", name: "Real Oviedo", city: "Oviedo", stadium: "Carlos Tartiere", capacity: 30500 },
        { id: "es2_mir", name: "CD Mirandés", city: "Miranda de Ebro", stadium: "Anduva", capacity: 5759 },
        { id: "es2_rac", name: "Racing Santander", city: "Santander", stadium: "El Sardinero", capacity: 22222 },
        { id: "es2_alm", name: "UD Almería", city: "Almería", stadium: "Power Horse Stadium", capacity: 15274 },
        { id: "es2_gra", name: "FC Granada", city: "Granada", stadium: "Nuevo Los Cármenes", capacity: 19336 },
        { id: "es2_hue", name: "SD Huesca", city: "Huesca", stadium: "El Alcoraz", capacity: 9128 },
        { id: "es2_cad", name: "FC Cádiz", city: "Cádiz", stadium: "Nuevo Mirandilla", capacity: 20724 },
        { id: "es2_spo", name: "Sporting Gijón", city: "Gijón", stadium: "El Molinón", capacity: 29029 },
        { id: "es2_cor", name: "Córdoba CF", city: "Córdoba", stadium: "Nuevo Arcángel", capacity: 20989 },
        { id: "es2_dep", name: "Deportivo La Coruña", city: "A Coruña", stadium: "Riazor", capacity: 32490 },
        { id: "es2_mal", name: "FC Málaga", city: "Málaga", stadium: "La Rosaleda", capacity: 30044 },
        { id: "es2_bur", name: "Burgos CF", city: "Burgos", stadium: "El Plantío", capacity: 12194 },
        { id: "es2_cas", name: "CD Castellón", city: "Castellón", stadium: "Nou Castàlia", capacity: 15500 },
        { id: "es2_alb", name: "Albacete Balompié", city: "Albacete", stadium: "Carlos Belmonte", capacity: 17524 },
        { id: "es2_eib", name: "SD Eibar", city: "Eibar", stadium: "Ipurua", capacity: 8164 },
        { id: "es2_zar", name: "Real Saragossa", city: "Zaragoza", stadium: "La Romareda", capacity: 33608 },
        { id: "es2_cat", name: "FC Cartagena", city: "Cartagena", stadium: "Cartagonova", capacity: 15105 },
        { id: "es2_ten", name: "CD Teneriffa", city: "Santa Cruz de Tenerife", stadium: "Heliodoro Rodríguez López", capacity: 22824 },
        { id: "es2_fer", name: "Racing Ferrol", city: "Ferrol", stadium: "A Malata", capacity: 12042 },
        { id: "es2_eld", name: "CD Eldense", city: "Elda", stadium: "Nuevo Pepico Amat", capacity: 4036 }
    ],

    es_liga_3: [
        { id: "es3_mur", name: "Real Murcia", city: "Murcia", stadium: "Enrique Roca", capacity: 31179 },
        { id: "es3_her", name: "Hércules Alicante", city: "Alicante", stadium: "José Rico Pérez", capacity: 29500 },
        { id: "es3_cul", name: "Cultural Leonesa", city: "León", stadium: "Reino de León", capacity: 13346 },
        { id: "es3_gim", name: "Gimnàstic Tarragona", city: "Tarragona", stadium: "Nou Estadi", capacity: 14591 },
        { id: "es3_lug", name: "CD Lugo", city: "Lugo", stadium: "Anxo Carro", capacity: 7840 },
        { id: "es3_pon", name: "SD Ponferradina", city: "Ponferrada", stadium: "El Toralín", capacity: 8400 },
        { id: "es3_ceu", name: "AD Ceuta", city: "Ceuta", stadium: "Alfonso Murube", capacity: 6500 },
        { id: "es3_rec", name: "Recreativo Huelva", city: "Huelva", stadium: "Nuevo Colombino", capacity: 21670 },
        { id: "es3_ibi", name: "UD Ibiza", city: "Ibiza", stadium: "Palladium Can Misses", capacity: 4500 },
        { id: "es3_alg", name: "Algeciras CF", city: "Algeciras", stadium: "Nuevo Mirador", capacity: 7200 },
        { id: "es3_sab", name: "CE Sabadell", city: "Sabadell", stadium: "Nova Creu Alta", capacity: 11908 },
        { id: "es3_alc", name: "CD Alcoyano", city: "Alcoy", stadium: "El Collao", capacity: 4850 },
        { id: "es3_uni", name: "Real Unión Irún", city: "Irun", stadium: "Stadium Gal", capacity: 5000 },
        { id: "es3_zam", name: "Zamora CF", city: "Zamora", stadium: "Ruta de la Plata", capacity: 7813 },
        { id: "es3_sal", name: "Unionistas de Salamanca", city: "Salamanca", stadium: "Reina Sofía", capacity: 4000 },
        { id: "es3_ant", name: "Antequera CF", city: "Antequera", stadium: "El Maulí", capacity: 6000 },
        { id: "es3_mer", name: "Mérida AD", city: "Mérida", stadium: "Romano José Fouto", capacity: 14600 },
        { id: "es3_fue", name: "CF Fuenlabrada", city: "Fuenlabrada", stadium: "Fernando Torres", capacity: 5400 },
        { id: "es3_bar", name: "Barakaldo CF", city: "Barakaldo", stadium: "Lasesarre", capacity: 7960 },
        { id: "es3_are", name: "CD Arenteiro", city: "O Carballiño", stadium: "Espiñedo", capacity: 2000 }
    ],

    // ------------------------------------------- Italien, Stufen 2 und 3
    // Serie B 2024/25; in der Serie C stehen Vereine aus allen drei
    // Staffeln, die auf oder nahe dieser Ebene spielen
    it_liga_2: [
        { id: "it2_sas", name: "US Sassuolo", city: "Sassuolo", stadium: "Mapei Stadium", capacity: 21525 },
        { id: "it2_pis", name: "Pisa SC", city: "Pisa", stadium: "Arena Garibaldi", capacity: 9000 },
        { id: "it2_spe", name: "Spezia Calcio", city: "La Spezia", stadium: "Alberto Picco", capacity: 10336 },
        { id: "it2_cre", name: "US Cremonese", city: "Cremona", stadium: "Giovanni Zini", capacity: 16003 },
        { id: "it2_jst", name: "Juve Stabia", city: "Castellammare di Stabia", stadium: "Romeo Menti", capacity: 7642 },
        { id: "it2_ctz", name: "US Catanzaro", city: "Catanzaro", stadium: "Nicola Ceravolo", capacity: 14650 },
        { id: "it2_pal", name: "FC Palermo", city: "Palermo", stadium: "Renzo Barbera", capacity: 36365 },
        { id: "it2_bar", name: "SSC Bari", city: "Bari", stadium: "San Nicola", capacity: 58270 },
        { id: "it2_mod", name: "Modena FC", city: "Modena", stadium: "Alberto Braglia", capacity: 21151 },
        { id: "it2_ces", name: "Cesena FC", city: "Cesena", stadium: "Dino Manuzzi", capacity: 23860 },
        { id: "it2_car", name: "Carrarese Calcio", city: "Carrara", stadium: "Stadio dei Marmi", capacity: 4500 },
        { id: "it2_sud", name: "FC Südtirol", city: "Bolzano", stadium: "Stadio Druso", capacity: 5539 },
        { id: "it2_reg", name: "AC Reggiana", city: "Reggio Emilia", stadium: "Città del Tricolore", capacity: 21525 },
        { id: "it2_man", name: "Mantova 1911", city: "Mantova", stadium: "Danilo Martelli", capacity: 14884 },
        { id: "it2_sam", name: "Sampdoria Genua", city: "Genova", stadium: "Luigi Ferraris", capacity: 33205 },
        { id: "it2_fro", name: "Frosinone Calcio", city: "Frosinone", stadium: "Benito Stirpe", capacity: 16227 },
        { id: "it2_bre", name: "Brescia Calcio", city: "Brescia", stadium: "Mario Rigamonti", capacity: 19550 },
        { id: "it2_sal", name: "US Salernitana", city: "Salerno", stadium: "Arechi", capacity: 37180 },
        { id: "it2_cit", name: "AS Cittadella", city: "Cittadella", stadium: "Pier Cesare Tombolato", capacity: 7623 },
        { id: "it2_cos", name: "Cosenza Calcio", city: "Cosenza", stadium: "San Vito-Gigi Marulla", capacity: 20987 }
    ],

    it_liga_3: [
        { id: "it3_ter", name: "Ternana Calcio", city: "Terni", stadium: "Libero Liberati", capacity: 22000 },
        { id: "it3_vic", name: "LR Vicenza", city: "Vicenza", stadium: "Romeo Menti", capacity: 12000 },
        { id: "it3_pad", name: "Calcio Padova", city: "Padova", stadium: "Euganeo", capacity: 18060 },
        { id: "it3_ben", name: "Benevento Calcio", city: "Benevento", stadium: "Ciro Vigorito", capacity: 16867 },
        { id: "it3_ave", name: "US Avellino", city: "Avellino", stadium: "Partenio-Lombardi", capacity: 26308 },
        { id: "it3_per", name: "AC Perugia", city: "Perugia", stadium: "Renato Curi", capacity: 23625 },
        { id: "it3_cat", name: "Catania FC", city: "Catania", stadium: "Angelo Massimino", capacity: 20016 },
        { id: "it3_pes", name: "Delfino Pescara", city: "Pescara", stadium: "Adriatico", capacity: 20476 },
        { id: "it3_tri", name: "US Triestina", city: "Trieste", stadium: "Nereo Rocco", capacity: 21214 },
        { id: "it3_cro", name: "FC Crotone", city: "Crotone", stadium: "Ezio Scida", capacity: 16640 },
        { id: "it3_are", name: "SS Arezzo", city: "Arezzo", stadium: "Città di Arezzo", capacity: 13128 },
        { id: "it3_fog", name: "Calcio Foggia", city: "Foggia", stadium: "Pino Zaccheria", capacity: 15000 },
        { id: "it3_nov", name: "Novara FC", city: "Novara", stadium: "Silvio Piola", capacity: 17875 },
        { id: "it3_fsa", name: "FeralpiSalò", city: "Salò", stadium: "Lino Turina", capacity: 2364 },
        { id: "it3_rim", name: "Rimini FC", city: "Rimini", stadium: "Romeo Neri", capacity: 9768 },
        { id: "it3_tre", name: "AC Trento", city: "Trento", stadium: "Briamasco", capacity: 4227 },
        { id: "it3_lec", name: "Calcio Lecco", city: "Lecco", stadium: "Rigamonti-Ceppi", capacity: 4977 },
        { id: "it3_mop", name: "SS Monopoli", city: "Monopoli", stadium: "Vito Simone Veneziani", capacity: 6880 },
        { id: "it3_pot", name: "Potenza Calcio", city: "Potenza", stadium: "Alfredo Viviani", capacity: 5500 },
        { id: "it3_tor", name: "SEF Torres", city: "Sassari", stadium: "Vanni Sanna", capacity: 7000 }
    ],

    // ---------------------------------------- Frankreich, Stufen 2 und 3
    // Ligue 2 2024/25; im National Vereine, die auf oder nahe dieser Ebene spielen
    fr_liga_2: [
        { id: "fr2_lor", name: "FC Lorient", city: "Lorient", stadium: "Stade du Moustoir", capacity: 18890 },
        { id: "fr2_pfc", name: "Paris FC", city: "Paris", stadium: "Stade Charléty", capacity: 20000 },
        { id: "fr2_met", name: "FC Metz", city: "Metz", stadium: "Stade Saint-Symphorien", capacity: 28786 },
        { id: "fr2_gui", name: "EA Guingamp", city: "Guingamp", stadium: "Stade du Roudourou", capacity: 18378 },
        { id: "fr2_dun", name: "USL Dunkerque", city: "Dunkerque", stadium: "Stade Marcel-Tribut", capacity: 4933 },
        { id: "fr2_ann", name: "FC Annecy", city: "Annecy", stadium: "Parc des Sports", capacity: 15660 },
        { id: "fr2_lav", name: "Stade Laval", city: "Laval", stadium: "Stade Francis-Le Basser", capacity: 18739 },
        { id: "fr2_bas", name: "SC Bastia", city: "Bastia", stadium: "Stade Armand-Cesari", capacity: 16078 },
        { id: "fr2_gre", name: "Grenoble Foot 38", city: "Grenoble", stadium: "Stade des Alpes", capacity: 20068 },
        { id: "fr2_pau", name: "Pau FC", city: "Pau", stadium: "Nouste Camp", capacity: 4031 },
        { id: "fr2_red", name: "Red Star Paris", city: "Saint-Ouen", stadium: "Stade Bauer", capacity: 10000 },
        { id: "fr2_ami", name: "Amiens SC", city: "Amiens", stadium: "Stade de la Licorne", capacity: 12097 },
        { id: "fr2_tro", name: "ESTAC Troyes", city: "Troyes", stadium: "Stade de l'Aube", capacity: 21684 },
        { id: "fr2_rod", name: "Rodez AF", city: "Rodez", stadium: "Stade Paul-Lignon", capacity: 5955 },
        { id: "fr2_cle", name: "Clermont Foot", city: "Clermont-Ferrand", stadium: "Stade Gabriel-Montpied", capacity: 11980 },
        { id: "fr2_aja", name: "AC Ajaccio", city: "Ajaccio", stadium: "Stade François-Coty", capacity: 10446 },
        { id: "fr2_mar", name: "FC Martigues", city: "Martigues", stadium: "Stade Francis-Turcan", capacity: 3000 },
        { id: "fr2_cae", name: "SM Caen", city: "Caen", stadium: "Stade Michel-d'Ornano", capacity: 20300 }
    ],

    fr_liga_3: [
        { id: "fr3_nan", name: "AS Nancy-Lorraine", city: "Nancy", stadium: "Stade Marcel-Picot", capacity: 20087 },
        { id: "fr3_lem", name: "Le Mans FC", city: "Le Mans", stadium: "MMArena", capacity: 25064 },
        { id: "fr3_bou", name: "US Boulogne", city: "Boulogne-sur-Mer", stadium: "Stade de la Libération", capacity: 8000 },
        { id: "fr3_soc", name: "FC Sochaux", city: "Montbéliard", stadium: "Stade Auguste-Bonal", capacity: 20005 },
        { id: "fr3_val", name: "Valenciennes FC", city: "Valenciennes", stadium: "Stade du Hainaut", capacity: 25172 },
        { id: "fr3_rou", name: "FC Rouen", city: "Rouen", stadium: "Stade Robert-Diochon", capacity: 12018 },
        { id: "fr3_dij", name: "Dijon FCO", city: "Dijon", stadium: "Stade Gaston-Gérard", capacity: 15995 },
        { id: "fr3_orl", name: "US Orléans", city: "Orléans", stadium: "Stade de la Source", capacity: 7533 },
        { id: "fr3_bpe", name: "FC Bourg-Péronnas", city: "Bourg-en-Bresse", stadium: "Stade Marcel-Verchère", capacity: 11400 },
        { id: "fr3_con", name: "US Concarneau", city: "Concarneau", stadium: "Stade Guy-Piriou", capacity: 6500 },
        { id: "fr3_qro", name: "US Quevilly-Rouen", city: "Le Petit-Quevilly", stadium: "Stade Robert-Diochon", capacity: 12018 },
        { id: "fr3_vil", name: "FC Villefranche", city: "Villefranche-sur-Saône", stadium: "Stade Armand-Chouffet", capacity: 3200 },
        { id: "fr3_ver", name: "FC Versailles", city: "Versailles", stadium: "Stade de Montbauron", capacity: 7500 },
        { id: "fr3_aub", name: "Aubagne FC", city: "Aubagne", stadium: "Stade de Lattre", capacity: 1500 },
        { id: "fr3_cha", name: "LB Châteauroux", city: "Châteauroux", stadium: "Stade Gaston-Petit", capacity: 17173 },
        { id: "fr3_nim", name: "Nîmes Olympique", city: "Nîmes", stadium: "Stade des Antonins", capacity: 8000 },
        { id: "fr3_p13", name: "Paris 13 Atletico", city: "Paris", stadium: "Stade Pelé", capacity: 2000 },
        { id: "fr3_cre", name: "US Créteil-Lusitanos", city: "Créteil", stadium: "Stade Dominique-Duvauchelle", capacity: 12150 }
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
