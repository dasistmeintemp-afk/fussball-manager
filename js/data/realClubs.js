/**
 * Die Vereine aller Ligen der Spielwelt
 *
 * Früher setzte der ClubGenerator die Vereine aus Städtenamen und
 * Namensbausteinen zusammen. Dabei entstanden Gebilde wie "Annecy Stade",
 * "Crewe Rangers" oder "Atalanta Avellino" - Namen, die aussehen wie
 * Fußball, aber keiner sind, und die nichts über die Stärke verraten.
 *
 * Diese Datei hinterlegt für jede Liga feste Vereine mit Stadt, Stadion und
 * Fassungsvermögen. Städte, Kapazitäten und die Rangfolge folgen den echten
 * Ligen der Saison 2024/25, die Namen von Vereinen und Stadien sind
 * erfunden. Die Reihenfolge ist die Rangfolge: Der erste Verein einer Liste
 * ist der stärkste, der letzte der schwächste. Der ClubGenerator leitet
 * daraus Ruf, Etat und Erwartungshaltung ab. Unterhalb der dritten Ligen
 * stehen Vereine, die auf oder nahe dieser Ebene spielen - nicht die
 * Staffeleinteilung eines bestimmten Jahres.
 *
 * Andere Namen kommen über eine Namensdatei (NamenEngine), die Kennungen
 * hier bleiben dabei gleich. Fehlt für eine Liga ein Eintrag oder reicht
 * die Liste nicht, füllt der ClubGenerator mit erzeugten Vereinen auf.
 */

const REAL_CLUBS_BY_LEAGUE = {

    // ---------------------------------------------------------- England
    en_liga_1: [
        { id: "en_mci", name: "Manchester Victoria", city: "Manchester", stadium: "Manchester Park", capacity: 53400 },
        { id: "en_liv", name: "Liverpool Victoria", city: "Liverpool", stadium: "Liverpool Park", capacity: 61276 },
        { id: "en_ars", name: "London United", city: "London", stadium: "London Park", capacity: 60704 },
        { id: "en_mun", name: "Manchester Wanderers", city: "Manchester", stadium: "Manchester Stadium", capacity: 74310 },
        { id: "en_che", name: "London City", city: "London", stadium: "London Arena", capacity: 40343 },
        { id: "en_tot", name: "London Corinthians", city: "London", stadium: "London Road", capacity: 62850 },
        { id: "en_new", name: "Newcastle Victoria", city: "Newcastle", stadium: "Newcastle Park", capacity: 52305 },
        { id: "en_avl", name: "Birmingham Olympic", city: "Birmingham", stadium: "Birmingham Park", capacity: 42682 },
        { id: "en_whu", name: "London Town", city: "London", stadium: "London Park North", capacity: 62500 },
        { id: "en_eve", name: "Liverpool Wanderers", city: "Liverpool", stadium: "Liverpool Stadium", capacity: 39414 },
        { id: "en_bha", name: "Brighton Wanderers", city: "Brighton", stadium: "Brighton Park", capacity: 31800 },
        { id: "en_cry", name: "London Rovers", city: "London", stadium: "London Park South", capacity: 25486 },
        { id: "en_ful", name: "London Albion", city: "London", stadium: "London Park East", capacity: 29589 },
        { id: "en_wol", name: "Wolverhampton Rovers", city: "Wolverhampton", stadium: "Wolverhampton Park", capacity: 31750 },
        { id: "en_nfo", name: "Nottingham Olympic", city: "Nottingham", stadium: "Nottingham Park", capacity: 30404 },
        { id: "en_bre", name: "London Olympic", city: "London", stadium: "London Lane", capacity: 17250 },
        { id: "en_lei", name: "Leicester Victoria", city: "Leicester", stadium: "Leicester Park", capacity: 32261 },
        { id: "en_bou", name: "Bournemouth Wanderers", city: "Bournemouth", stadium: "Bournemouth Road", capacity: 11307 },
        { id: "en_sou", name: "Southampton Corinthians", city: "Southampton", stadium: "Southampton Park", capacity: 32384 },
        { id: "en_ips", name: "Ipswich Borough", city: "Ipswich", stadium: "Ipswich Park", capacity: 30311 }
    ],

    // ---------------------------------------------------------- Spanien
    es_liga_1: [
        { id: "es_rma", name: "CD Madrid", city: "Madrid", stadium: "Estadio Madrid", capacity: 78297 },
        { id: "es_fcb", name: "Unión Barcelona", city: "Barcelona", stadium: "Estadio Barcelona", capacity: 99354 },
        { id: "es_atm", name: "Juventud Madrid", city: "Madrid", stadium: "Estadio Municipal de Madrid", capacity: 70460 },
        { id: "es_ath", name: "CF Bilbao", city: "Bilbao", stadium: "Estadio Bilbao", capacity: 53289 },
        { id: "es_sev", name: "Club Sevilla", city: "Sevilla", stadium: "Estadio Sevilla", capacity: 43883 },
        { id: "es_rso", name: "Club San Sebastián", city: "San Sebastián", stadium: "Estadio San Sebastián", capacity: 39500 },
        { id: "es_bet", name: "CD Sevilla", city: "Sevilla", stadium: "Estadio Municipal de Sevilla", capacity: 60720 },
        { id: "es_vil", name: "SD Villarreal", city: "Villarreal", stadium: "Estadio Villarreal", capacity: 23500 },
        { id: "es_val", name: "UD Valencia", city: "Valencia", stadium: "Estadio Valencia", capacity: 49430 },
        { id: "es_cel", name: "Atlético Vigo", city: "Vigo", stadium: "Estadio Vigo", capacity: 29000 },
        { id: "es_gir", name: "SD Girona", city: "Girona", stadium: "Campo Girona", capacity: 14624 },
        { id: "es_osa", name: "Atlético Pamplona", city: "Pamplona", stadium: "Estadio Pamplona", capacity: 23576 },
        { id: "es_esp", name: "SD Barcelona", city: "Barcelona", stadium: "Estadio Municipal de Barcelona", capacity: 40000 },
        { id: "es_ray", name: "CF Madrid", city: "Madrid", stadium: "Campo Madrid", capacity: 14708 },
        { id: "es_mll", name: "Arenas Palma", city: "Palma", stadium: "Estadio Palma", capacity: 23142 },
        { id: "es_get", name: "Club Getafe", city: "Getafe", stadium: "Campo Getafe", capacity: 17393 },
        { id: "es_ala", name: "SD Vitoria", city: "Vitoria", stadium: "Campo Vitoria", capacity: 19840 },
        { id: "es_lpa", name: "Racing Las Palmas", city: "Las Palmas", stadium: "Estadio Las Palmas", capacity: 32400 },
        { id: "es_leg", name: "CF Leganés", city: "Leganés", stadium: "Campo Leganés", capacity: 12450 },
        { id: "es_vll", name: "UD Valladolid", city: "Valladolid", stadium: "Estadio Valladolid", capacity: 27618 }
    ],

    // ---------------------------------------------------------- Italien
    it_liga_1: [
        { id: "it_int", name: "Atletico Milano", city: "Milano", stadium: "Stadio Milano", capacity: 75923 },
        { id: "it_mil", name: "Libertas Milano", city: "Milano", stadium: "Stadio Comunale di Milano", capacity: 75923 },
        { id: "it_juv", name: "Calcio Torino", city: "Torino", stadium: "Stadio Torino", capacity: 41507 },
        { id: "it_nap", name: "Libertas Napoli", city: "Napoli", stadium: "Stadio Napoli", capacity: 54726 },
        { id: "it_rom", name: "Pro Roma", city: "Roma", stadium: "Stadio Roma", capacity: 70634 },
        { id: "it_ata", name: "AS Bergamo", city: "Bergamo", stadium: "Stadio Bergamo", capacity: 24950 },
        { id: "it_laz", name: "Atletico Roma", city: "Roma", stadium: "Stadio Comunale di Roma", capacity: 70634 },
        { id: "it_fio", name: "Polisportiva Firenze", city: "Firenze", stadium: "Stadio Firenze", capacity: 43147 },
        { id: "it_bol", name: "AS Bologna", city: "Bologna", stadium: "Stadio Bologna", capacity: 38279 },
        { id: "it_tor", name: "US Torino", city: "Torino", stadium: "Stadio Comunale di Torino", capacity: 28177 },
        { id: "it_udi", name: "Polisportiva Udine", city: "Udine", stadium: "Stadio Udine", capacity: 25144 },
        { id: "it_gen", name: "Polisportiva Genova", city: "Genova", stadium: "Stadio Genova", capacity: 33205 },
        { id: "it_cag", name: "Virtus Cagliari", city: "Cagliari", stadium: "Stadio Comunale di Cagliari", capacity: 16416 },
        { id: "it_ver", name: "Pro Verona", city: "Verona", stadium: "Stadio Verona", capacity: 39211 },
        { id: "it_lec", name: "Atletico Lecce", city: "Lecce", stadium: "Stadio Lecce", capacity: 31533 },
        { id: "it_par", name: "AC Parma", city: "Parma", stadium: "Stadio Parma", capacity: 22352 },
        { id: "it_emp", name: "US Empoli", city: "Empoli", stadium: "Stadio Comunale di Empoli", capacity: 16284 },
        { id: "it_com", name: "Atletico Como", city: "Como", stadium: "Stadio Comunale di Como", capacity: 13602 },
        { id: "it_mon", name: "Audace Monza", city: "Monza", stadium: "Stadio Comunale di Monza", capacity: 15039 },
        { id: "it_ven", name: "AS Venezia", city: "Venezia", stadium: "Stadio Comunale di Venezia", capacity: 11150 }
    ],

    // -------------------------------------------------------- Frankreich
    fr_liga_1: [
        { id: "fr_psg", name: "Racing Paris", city: "Paris", stadium: "Stade de Paris", capacity: 47929 },
        { id: "fr_mon", name: "Sporting Monaco", city: "Monaco", stadium: "Stade Municipal de Monaco", capacity: 18523 },
        { id: "fr_mar", name: "Racing Marseille", city: "Marseille", stadium: "Stade de Marseille", capacity: 67394 },
        { id: "fr_lil", name: "Étoile Lille", city: "Lille", stadium: "Stade de Lille", capacity: 50186 },
        { id: "fr_lyo", name: "Stade Lyon", city: "Lyon", stadium: "Stade de Lyon", capacity: 59186 },
        { id: "fr_nic", name: "Olympique Nice", city: "Nice", stadium: "Stade de Nice", capacity: 35624 },
        { id: "fr_len", name: "Sporting Lens", city: "Lens", stadium: "Stade de Lens", capacity: 38058 },
        { id: "fr_ren", name: "Olympique Rennes", city: "Rennes", stadium: "Stade de Rennes", capacity: 29778 },
        { id: "fr_bre", name: "Union Brest", city: "Brest", stadium: "Stade Municipal de Brest", capacity: 15220 },
        { id: "fr_str", name: "SC Strasbourg", city: "Strasbourg", stadium: "Stade de Strasbourg", capacity: 26109 },
        { id: "fr_tou", name: "AJ Toulouse", city: "Toulouse", stadium: "Stade de Toulouse", capacity: 33150 },
        { id: "fr_rei", name: "AJ Reims", city: "Reims", stadium: "Stade de Reims", capacity: 21684 },
        { id: "fr_nan", name: "AJ Nantes", city: "Nantes", stadium: "Stade de Nantes", capacity: 35322 },
        { id: "fr_aux", name: "Union Auxerre", city: "Auxerre", stadium: "Stade d'Auxerre", capacity: 21379 },
        { id: "fr_ang", name: "Étoile Angers", city: "Angers", stadium: "Stade Municipal d'Angers", capacity: 18752 },
        { id: "fr_lehav", name: "Avenir Le Havre", city: "Le Havre", stadium: "Stade du Havre", capacity: 25178 },
        { id: "fr_ste", name: "Racing Saint-Étienne", city: "Saint-Étienne", stadium: "Stade de Saint-Étienne", capacity: 41965 },
        { id: "fr_mtp", name: "Avenir Montpellier", city: "Montpellier", stadium: "Stade de Montpellier", capacity: 32900 }
    ],

    // ------------------------------------------- England, Stufen 2 und 3
    // Championship und League One in der Zusammensetzung 2024/25
    en_liga_2: [
        { id: "en2_lee", name: "Leeds City", city: "Leeds", stadium: "Leeds Park", capacity: 37645 },
        { id: "en2_bur", name: "Burnley Albion", city: "Burnley", stadium: "Burnley Park", capacity: 21944 },
        { id: "en2_shu", name: "Sheffield Rangers", city: "Sheffield", stadium: "Sheffield Park", capacity: 32050 },
        { id: "en2_sun", name: "Sunderland Wanderers", city: "Sunderland", stadium: "Sunderland Park", capacity: 49000 },
        { id: "en2_mid", name: "Middlesbrough Town", city: "Middlesbrough", stadium: "Middlesbrough Park", capacity: 34742 },
        { id: "en2_cov", name: "Coventry United", city: "Coventry", stadium: "Coventry Park", capacity: 32609 },
        { id: "en2_wba", name: "West Bromwich Town", city: "West Bromwich", stadium: "West Bromwich Park", capacity: 26850 },
        { id: "en2_bri", name: "Bristol United", city: "Bristol", stadium: "Bristol Park", capacity: 27000 },
        { id: "en2_nor", name: "Norwich Victoria", city: "Norwich", stadium: "Norwich Park", capacity: 27359 },
        { id: "en2_wat", name: "Watford County", city: "Watford", stadium: "Watford Park", capacity: 22200 },
        { id: "en2_swa", name: "Swansea Rovers", city: "Swansea", stadium: "Swansea Park", capacity: 21088 },
        { id: "en2_mil", name: "London Wanderers", city: "London", stadium: "London Park West", capacity: 20146 },
        { id: "en2_bla", name: "Blackburn Corinthians", city: "Blackburn", stadium: "Blackburn Park", capacity: 31367 },
        { id: "en2_shw", name: "Sheffield Corinthians", city: "Sheffield", stadium: "Sheffield Stadium", capacity: 39732 },
        { id: "en2_sto", name: "Stoke-on-Trent Borough", city: "Stoke-on-Trent", stadium: "Stoke-on-Trent Park", capacity: 30089 },
        { id: "en2_qpr", name: "London Harriers", city: "London", stadium: "London Ground", capacity: 18439 },
        { id: "en2_hul", name: "Hull Wanderers", city: "Hull", stadium: "Hull Park", capacity: 25586 },
        { id: "en2_pre", name: "Preston City", city: "Preston", stadium: "Preston Park", capacity: 23404 },
        { id: "en2_der", name: "Derby Wanderers", city: "Derby", stadium: "Derby Park", capacity: 32956 },
        { id: "en2_por", name: "Portsmouth Harriers", city: "Portsmouth", stadium: "Portsmouth Park", capacity: 20688 },
        { id: "en2_oxf", name: "Oxford Wanderers", city: "Oxford", stadium: "Oxford Road", capacity: 12500 },
        { id: "en2_lut", name: "Luton Athletic", city: "Luton", stadium: "Luton Road", capacity: 12000 },
        { id: "en2_ply", name: "Plymouth County", city: "Plymouth", stadium: "Plymouth Road", capacity: 17900 },
        { id: "en2_car", name: "Cardiff Town", city: "Cardiff", stadium: "Cardiff Park", capacity: 33280 }
    ],

    en_liga_3: [
        { id: "en3_bir", name: "Birmingham Corinthians", city: "Birmingham", stadium: "Birmingham Stadium", capacity: 29409 },
        { id: "en3_wre", name: "Wrexham County", city: "Wrexham", stadium: "Wrexham Road", capacity: 12600 },
        { id: "en3_sto", name: "Stockport Athletic", city: "Stockport", stadium: "Stockport Road", capacity: 10852 },
        { id: "en3_cha", name: "London Rangers", city: "London", stadium: "London Stadium North", capacity: 27111 },
        { id: "en3_wyc", name: "High Wycombe Victoria", city: "High Wycombe", stadium: "High Wycombe Road", capacity: 9448 },
        { id: "en3_ley", name: "London Athletic", city: "London", stadium: "London Road North", capacity: 9271 },
        { id: "en3_rea", name: "Reading Victoria", city: "Reading", stadium: "Reading Park", capacity: 24161 },
        { id: "en3_bol", name: "Bolton Victoria", city: "Bolton", stadium: "Bolton Park", capacity: 28723 },
        { id: "en3_bpl", name: "Blackpool Town", city: "Blackpool", stadium: "Blackpool Road", capacity: 16616 },
        { id: "en3_hud", name: "Huddersfield Borough", city: "Huddersfield", stadium: "Huddersfield Park", capacity: 24121 },
        { id: "en3_lin", name: "Lincoln Wanderers", city: "Lincoln", stadium: "Lincoln Road", capacity: 10780 },
        { id: "en3_bar", name: "Barnsley Rovers", city: "Barnsley", stadium: "Barnsley Park", capacity: 23287 },
        { id: "en3_rot", name: "Rotherham Wanderers", city: "Rotherham", stadium: "Rotherham Road", capacity: 12021 },
        { id: "en3_ste", name: "Stevenage Town", city: "Stevenage", stadium: "Stevenage Road", capacity: 7800 },
        { id: "en3_wig", name: "Wigan Wanderers", city: "Wigan", stadium: "Wigan Park", capacity: 25138 },
        { id: "en3_exe", name: "Exeter Olympic", city: "Exeter", stadium: "Exeter Road", capacity: 8696 },
        { id: "en3_man", name: "Mansfield Olympic", city: "Mansfield", stadium: "Mansfield Road", capacity: 9186 },
        { id: "en3_pet", name: "Peterborough Victoria", city: "Peterborough", stadium: "Peterborough Road", capacity: 15314 },
        { id: "en3_nor", name: "Northampton Athletic", city: "Northampton", stadium: "Northampton Road", capacity: 7724 },
        { id: "en3_bur", name: "Burton upon Trent Rovers", city: "Burton upon Trent", stadium: "Burton upon Trent Road", capacity: 6912 },
        { id: "en3_cra", name: "Crawley Rovers", city: "Crawley", stadium: "Crawley Road", capacity: 6134 },
        { id: "en3_brr", name: "Bristol Wanderers", city: "Bristol", stadium: "Bristol Road", capacity: 9832 },
        { id: "en3_cam", name: "Cambridge Albion", city: "Cambridge", stadium: "Cambridge Road", capacity: 8127 },
        { id: "en3_shr", name: "Shrewsbury Harriers", city: "Shrewsbury", stadium: "Shrewsbury Road", capacity: 9875 }
    ],

    // ------------------------------------------- Spanien, Stufen 2 und 3
    // Segunda División 2024/25; in der dritten Liga, der Primera Federación,
    // stehen Vereine, die auf oder nahe dieser Ebene spielen
    es_liga_2: [
        { id: "es2_lev", name: "SD Valencia", city: "Valencia", stadium: "Estadio Municipal de Valencia", capacity: 26354 },
        { id: "es2_elc", name: "Sporting Elche", city: "Elche", stadium: "Estadio Elche", capacity: 31388 },
        { id: "es2_ovi", name: "CD Oviedo", city: "Oviedo", stadium: "Estadio Oviedo", capacity: 30500 },
        { id: "es2_mir", name: "Arenas Miranda de Ebro", city: "Miranda de Ebro", stadium: "Campo Miranda de Ebro", capacity: 5759 },
        { id: "es2_rac", name: "Juventud Santander", city: "Santander", stadium: "Estadio Santander", capacity: 22222 },
        { id: "es2_alm", name: "Racing Almería", city: "Almería", stadium: "Campo Almería", capacity: 15274 },
        { id: "es2_gra", name: "SD Granada", city: "Granada", stadium: "Campo Granada", capacity: 19336 },
        { id: "es2_hue", name: "Arenas Huesca", city: "Huesca", stadium: "Campo Huesca", capacity: 9128 },
        { id: "es2_cad", name: "CF Cádiz", city: "Cádiz", stadium: "Estadio Cádiz", capacity: 20724 },
        { id: "es2_spo", name: "Club Gijón", city: "Gijón", stadium: "Estadio Gijón", capacity: 29029 },
        { id: "es2_cor", name: "Club Córdoba", city: "Córdoba", stadium: "Estadio Córdoba", capacity: 20989 },
        { id: "es2_dep", name: "Unión A Coruña", city: "A Coruña", stadium: "Estadio A Coruña", capacity: 32490 },
        { id: "es2_mal", name: "CF Málaga", city: "Málaga", stadium: "Estadio Málaga", capacity: 30044 },
        { id: "es2_bur", name: "Racing Burgos", city: "Burgos", stadium: "Campo Burgos", capacity: 12194 },
        { id: "es2_cas", name: "SD Castellón", city: "Castellón", stadium: "Campo Castellón", capacity: 15500 },
        { id: "es2_alb", name: "Deportivo Albacete", city: "Albacete", stadium: "Campo Albacete", capacity: 17524 },
        { id: "es2_eib", name: "Unión Eibar", city: "Eibar", stadium: "Campo Eibar", capacity: 8164 },
        { id: "es2_zar", name: "CD Zaragoza", city: "Zaragoza", stadium: "Estadio Zaragoza", capacity: 33608 },
        { id: "es2_cat", name: "CF Cartagena", city: "Cartagena", stadium: "Campo Cartagena", capacity: 15105 },
        { id: "es2_ten", name: "Atlético Santa Cruz de Tenerife", city: "Santa Cruz de Tenerife", stadium: "Estadio Santa Cruz de Tenerife", capacity: 22824 },
        { id: "es2_fer", name: "SD Ferrol", city: "Ferrol", stadium: "Campo Ferrol", capacity: 12042 },
        { id: "es2_eld", name: "Racing Elda", city: "Elda", stadium: "Campo Elda", capacity: 4036 }
    ],

    es_liga_3: [
        { id: "es3_mur", name: "Racing Murcia", city: "Murcia", stadium: "Estadio Murcia", capacity: 31179 },
        { id: "es3_her", name: "Club Alicante", city: "Alicante", stadium: "Estadio Alicante", capacity: 29500 },
        { id: "es3_cul", name: "SD León", city: "León", stadium: "Campo León", capacity: 13346 },
        { id: "es3_gim", name: "CF Tarragona", city: "Tarragona", stadium: "Campo Tarragona", capacity: 14591 },
        { id: "es3_lug", name: "Deportivo Lugo", city: "Lugo", stadium: "Campo Lugo", capacity: 7840 },
        { id: "es3_pon", name: "Unión Ponferrada", city: "Ponferrada", stadium: "Campo Ponferrada", capacity: 8400 },
        { id: "es3_ceu", name: "CD Ceuta", city: "Ceuta", stadium: "Campo Ceuta", capacity: 6500 },
        { id: "es3_rec", name: "SD Huelva", city: "Huelva", stadium: "Estadio Huelva", capacity: 21670 },
        { id: "es3_ibi", name: "Racing Ibiza", city: "Ibiza", stadium: "Campo Ibiza", capacity: 4500 },
        { id: "es3_alg", name: "Club Algeciras", city: "Algeciras", stadium: "Campo Algeciras", capacity: 7200 },
        { id: "es3_sab", name: "Unión Sabadell", city: "Sabadell", stadium: "Campo Sabadell", capacity: 11908 },
        { id: "es3_alc", name: "Sporting Alcoy", city: "Alcoy", stadium: "Campo Alcoy", capacity: 4850 },
        { id: "es3_uni", name: "Racing Irun", city: "Irun", stadium: "Campo Irun", capacity: 5000 },
        { id: "es3_zam", name: "CD Zamora", city: "Zamora", stadium: "Campo Zamora", capacity: 7813 },
        { id: "es3_sal", name: "Arenas Salamanca", city: "Salamanca", stadium: "Campo Salamanca", capacity: 4000 },
        { id: "es3_ant", name: "CD Antequera", city: "Antequera", stadium: "Campo Antequera", capacity: 6000 },
        { id: "es3_mer", name: "CD Mérida", city: "Mérida", stadium: "Campo Mérida", capacity: 14600 },
        { id: "es3_fue", name: "Sporting Fuenlabrada", city: "Fuenlabrada", stadium: "Campo Fuenlabrada", capacity: 5400 },
        { id: "es3_bar", name: "Unión Barakaldo", city: "Barakaldo", stadium: "Campo Barakaldo", capacity: 7960 },
        { id: "es3_are", name: "Arenas O Carballiño", city: "O Carballiño", stadium: "Campo O Carballiño", capacity: 2000 }
    ],

    // ------------------------------------------- Italien, Stufen 2 und 3
    // Serie B 2024/25; in der Serie C stehen Vereine aus allen drei
    // Staffeln, die auf oder nahe dieser Ebene spielen
    it_liga_2: [
        { id: "it2_sas", name: "Pro Sassuolo", city: "Sassuolo", stadium: "Stadio Sassuolo", capacity: 21525 },
        { id: "it2_pis", name: "AC Pisa", city: "Pisa", stadium: "Stadio Comunale di Pisa", capacity: 9000 },
        { id: "it2_spe", name: "Atletico La Spezia", city: "La Spezia", stadium: "Stadio Comunale di La Spezia", capacity: 10336 },
        { id: "it2_cre", name: "AC Cremona", city: "Cremona", stadium: "Stadio Comunale di Cremona", capacity: 16003 },
        { id: "it2_jst", name: "Polisportiva Castellammare di Stabia", city: "Castellammare di Stabia", stadium: "Stadio Comunale di Castellammare di Stabia", capacity: 7642 },
        { id: "it2_ctz", name: "Calcio Catanzaro", city: "Catanzaro", stadium: "Stadio Comunale di Catanzaro", capacity: 14650 },
        { id: "it2_pal", name: "Pro Palermo", city: "Palermo", stadium: "Stadio Palermo", capacity: 36365 },
        { id: "it2_bar", name: "Libertas Bari", city: "Bari", stadium: "Stadio Bari", capacity: 58270 },
        { id: "it2_mod", name: "Pro Modena", city: "Modena", stadium: "Stadio Modena", capacity: 21151 },
        { id: "it2_ces", name: "Calcio Cesena", city: "Cesena", stadium: "Stadio Cesena", capacity: 23860 },
        { id: "it2_car", name: "AS Carrara", city: "Carrara", stadium: "Stadio Comunale di Carrara", capacity: 4500 },
        { id: "it2_sud", name: "US Bolzano", city: "Bolzano", stadium: "Stadio Comunale di Bolzano", capacity: 5539 },
        { id: "it2_reg", name: "Calcio Reggio Emilia", city: "Reggio Emilia", stadium: "Stadio Reggio Emilia", capacity: 21525 },
        { id: "it2_man", name: "Calcio Mantova", city: "Mantova", stadium: "Stadio Comunale di Mantova", capacity: 14884 },
        { id: "it2_sam", name: "Calcio Genova", city: "Genova", stadium: "Stadio Comunale di Genova", capacity: 33205 },
        { id: "it2_fro", name: "Virtus Frosinone", city: "Frosinone", stadium: "Stadio Comunale di Frosinone", capacity: 16227 },
        { id: "it2_bre", name: "AS Brescia", city: "Brescia", stadium: "Stadio Comunale di Brescia", capacity: 19550 },
        { id: "it2_sal", name: "AS Salerno", city: "Salerno", stadium: "Stadio Salerno", capacity: 37180 },
        { id: "it2_cit", name: "Virtus Cittadella", city: "Cittadella", stadium: "Stadio Comunale di Cittadella", capacity: 7623 },
        { id: "it2_cos", name: "Audace Cosenza", city: "Cosenza", stadium: "Stadio Cosenza", capacity: 20987 }
    ],

    it_liga_3: [
        { id: "it3_ter", name: "SS Terni", city: "Terni", stadium: "Stadio Terni", capacity: 22000 },
        { id: "it3_vic", name: "Polisportiva Vicenza", city: "Vicenza", stadium: "Stadio Comunale di Vicenza", capacity: 12000 },
        { id: "it3_pad", name: "SS Padova", city: "Padova", stadium: "Stadio Comunale di Padova", capacity: 18060 },
        { id: "it3_ben", name: "Pro Benevento", city: "Benevento", stadium: "Stadio Comunale di Benevento", capacity: 16867 },
        { id: "it3_ave", name: "AS Avellino", city: "Avellino", stadium: "Stadio Avellino", capacity: 26308 },
        { id: "it3_per", name: "Sporting Perugia", city: "Perugia", stadium: "Stadio Perugia", capacity: 23625 },
        { id: "it3_cat", name: "SS Catania", city: "Catania", stadium: "Stadio Catania", capacity: 20016 },
        { id: "it3_pes", name: "SS Pescara", city: "Pescara", stadium: "Stadio Pescara", capacity: 20476 },
        { id: "it3_tri", name: "Audace Trieste", city: "Trieste", stadium: "Stadio Trieste", capacity: 21214 },
        { id: "it3_cro", name: "Pro Crotone", city: "Crotone", stadium: "Stadio Comunale di Crotone", capacity: 16640 },
        { id: "it3_are", name: "Audace Arezzo", city: "Arezzo", stadium: "Stadio Comunale di Arezzo", capacity: 13128 },
        { id: "it3_fog", name: "AC Foggia", city: "Foggia", stadium: "Stadio Comunale di Foggia", capacity: 15000 },
        { id: "it3_nov", name: "Virtus Novara", city: "Novara", stadium: "Stadio Comunale di Novara", capacity: 17875 },
        { id: "it3_fsa", name: "Sporting Salò", city: "Salò", stadium: "Stadio Comunale di Salò", capacity: 2364 },
        { id: "it3_rim", name: "Virtus Rimini", city: "Rimini", stadium: "Stadio Comunale di Rimini", capacity: 9768 },
        { id: "it3_tre", name: "Atletico Trento", city: "Trento", stadium: "Stadio Comunale di Trento", capacity: 4227 },
        { id: "it3_lec", name: "Audace Lecco", city: "Lecco", stadium: "Stadio Comunale di Lecco", capacity: 4977 },
        { id: "it3_mop", name: "US Monopoli", city: "Monopoli", stadium: "Stadio Comunale di Monopoli", capacity: 6880 },
        { id: "it3_pot", name: "Libertas Potenza", city: "Potenza", stadium: "Stadio Comunale di Potenza", capacity: 5500 },
        { id: "it3_tor", name: "US Sassari", city: "Sassari", stadium: "Stadio Comunale di Sassari", capacity: 7000 }
    ],

    // ---------------------------------------- Frankreich, Stufen 2 und 3
    // Ligue 2 2024/25; im National Vereine, die auf oder nahe dieser Ebene spielen
    fr_liga_2: [
        { id: "fr2_lor", name: "Union Lorient", city: "Lorient", stadium: "Stade Municipal de Lorient", capacity: 18890 },
        { id: "fr2_pfc", name: "Étoile Paris", city: "Paris", stadium: "Stade Municipal de Paris", capacity: 20000 },
        { id: "fr2_met", name: "AJ Metz", city: "Metz", stadium: "Stade de Metz", capacity: 28786 },
        { id: "fr2_gui", name: "Avenir Guingamp", city: "Guingamp", stadium: "Stade Municipal de Guingamp", capacity: 18378 },
        { id: "fr2_dun", name: "Olympique Dunkerque", city: "Dunkerque", stadium: "Stade Municipal de Dunkerque", capacity: 4933 },
        { id: "fr2_ann", name: "Avenir Annecy", city: "Annecy", stadium: "Stade Municipal d'Annecy", capacity: 15660 },
        { id: "fr2_lav", name: "AS Laval", city: "Laval", stadium: "Stade Municipal de Laval", capacity: 18739 },
        { id: "fr2_bas", name: "Racing Bastia", city: "Bastia", stadium: "Stade Municipal de Bastia", capacity: 16078 },
        { id: "fr2_gre", name: "Avenir Grenoble", city: "Grenoble", stadium: "Stade de Grenoble", capacity: 20068 },
        { id: "fr2_pau", name: "AJ Pau", city: "Pau", stadium: "Stade Municipal de Pau", capacity: 4031 },
        { id: "fr2_red", name: "Union Saint-Ouen", city: "Saint-Ouen", stadium: "Stade Municipal de Saint-Ouen", capacity: 10000 },
        { id: "fr2_ami", name: "Avenir Amiens", city: "Amiens", stadium: "Stade Municipal d'Amiens", capacity: 12097 },
        { id: "fr2_tro", name: "Avenir Troyes", city: "Troyes", stadium: "Stade de Troyes", capacity: 21684 },
        { id: "fr2_rod", name: "AJ Rodez", city: "Rodez", stadium: "Stade Municipal de Rodez", capacity: 5955 },
        { id: "fr2_cle", name: "Étoile Clermont-Ferrand", city: "Clermont-Ferrand", stadium: "Stade Municipal de Clermont-Ferrand", capacity: 11980 },
        { id: "fr2_aja", name: "FC Ajaccio", city: "Ajaccio", stadium: "Stade Municipal d'Ajaccio", capacity: 10446 },
        { id: "fr2_mar", name: "Olympique Martigues", city: "Martigues", stadium: "Stade Municipal de Martigues", capacity: 3000 },
        { id: "fr2_cae", name: "Sporting Caen", city: "Caen", stadium: "Stade de Caen", capacity: 20300 }
    ],

    fr_liga_3: [
        { id: "fr3_nan", name: "Sporting Nancy", city: "Nancy", stadium: "Stade de Nancy", capacity: 20087 },
        { id: "fr3_lem", name: "US Le Mans", city: "Le Mans", stadium: "Stade du Mans", capacity: 25064 },
        { id: "fr3_bou", name: "Étoile Boulogne-sur-Mer", city: "Boulogne-sur-Mer", stadium: "Stade Municipal de Boulogne-sur-Mer", capacity: 8000 },
        { id: "fr3_soc", name: "AJ Montbéliard", city: "Montbéliard", stadium: "Stade de Montbéliard", capacity: 20005 },
        { id: "fr3_val", name: "SC Valenciennes", city: "Valenciennes", stadium: "Stade de Valenciennes", capacity: 25172 },
        { id: "fr3_rou", name: "AS Rouen", city: "Rouen", stadium: "Stade Municipal de Rouen", capacity: 12018 },
        { id: "fr3_dij", name: "US Dijon", city: "Dijon", stadium: "Stade Municipal de Dijon", capacity: 15995 },
        { id: "fr3_orl", name: "Union Orléans", city: "Orléans", stadium: "Stade Municipal d'Orléans", capacity: 7533 },
        { id: "fr3_bpe", name: "AS Bourg-en-Bresse", city: "Bourg-en-Bresse", stadium: "Stade Municipal de Bourg-en-Bresse", capacity: 11400 },
        { id: "fr3_con", name: "Racing Concarneau", city: "Concarneau", stadium: "Stade Municipal de Concarneau", capacity: 6500 },
        { id: "fr3_qro", name: "Racing Le Petit-Quevilly", city: "Le Petit-Quevilly", stadium: "Stade Municipal du Petit-Quevilly", capacity: 12018 },
        { id: "fr3_vil", name: "Union Villefranche-sur-Saône", city: "Villefranche-sur-Saône", stadium: "Stade Municipal de Villefranche-sur-Saône", capacity: 3200 },
        { id: "fr3_ver", name: "US Versailles", city: "Versailles", stadium: "Stade Municipal de Versailles", capacity: 7500 },
        { id: "fr3_aub", name: "Racing Aubagne", city: "Aubagne", stadium: "Stade Municipal d'Aubagne", capacity: 1500 },
        { id: "fr3_cha", name: "Avenir Châteauroux", city: "Châteauroux", stadium: "Stade Municipal de Châteauroux", capacity: 17173 },
        { id: "fr3_nim", name: "Étoile Nîmes", city: "Nîmes", stadium: "Stade Municipal de Nîmes", capacity: 8000 },
        { id: "fr3_p13", name: "FC Paris", city: "Paris", stadium: "Parc des Sports de Paris", capacity: 2000 },
        { id: "fr3_cre", name: "Étoile Créteil", city: "Créteil", stadium: "Stade Municipal de Créteil", capacity: 12150 }
    ],

    // --------------------------------------------------- 2. Bundesliga
    // Ohne die Vereine, die in dieser Spielwelt schon erstklassig sind
    // (Hamburger SV, Schalke 04, 1. FC Köln, VfL Bochum).
    de_liga_2: [
        { id: "de2_h96", name: "SV Hannover", city: "Hannover", stadium: "Arena Hannover", capacity: 49000 },
        { id: "de2_her", name: "FSV Berlin", city: "Berlin", stadium: "Arena Berlin", capacity: 74667 },
        { id: "de2_f95", name: "SSV Düsseldorf", city: "Düsseldorf", stadium: "Arena Düsseldorf", capacity: 54600 },
        { id: "de2_fck", name: "Viktoria Kaiserslautern", city: "Kaiserslautern", stadium: "Arena Kaiserslautern", capacity: 49780 },
        { id: "de2_stp", name: "TSV Hamburg", city: "Hamburg", stadium: "Arena Hamburg", capacity: 29546 },
        { id: "de2_fcn", name: "Grün-Weiß Nürnberg", city: "Nürnberg", stadium: "Arena Nürnberg", capacity: 50000 },
        { id: "de2_ksc", name: "Sportfreunde Karlsruhe", city: "Karlsruhe", stadium: "Arena Karlsruhe", capacity: 34302 },
        { id: "de2_dsc", name: "Blau-Weiß Bielefeld", city: "Bielefeld", stadium: "Arena Bielefeld", capacity: 26515 },
        { id: "de2_fcm", name: "TSV Magdeburg", city: "Magdeburg", stadium: "Arena Magdeburg", capacity: 30098 },
        { id: "de2_eint", name: "SSV Braunschweig", city: "Braunschweig", stadium: "Arena Braunschweig", capacity: 23325 },
        { id: "de2_d98", name: "Viktoria Darmstadt", city: "Darmstadt", stadium: "Sportpark Darmstadt", capacity: 17810 },
        { id: "de2_ksv", name: "Blau-Weiß Kiel", city: "Kiel", stadium: "Sportpark Kiel", capacity: 15034 },
        { id: "de2_scp", name: "SpVgg Paderborn", city: "Paderborn", stadium: "Sportpark Paderborn", capacity: 15000 },
        { id: "de2_sgf", name: "Rot-Weiß Fürth", city: "Fürth", stadium: "Sportpark Fürth", capacity: 16626 },
        { id: "de2_vfl", name: "SSV Osnabrück", city: "Osnabrück", stadium: "Sportpark Osnabrück", capacity: 15741 },
        { id: "de2_ssv", name: "Blau-Weiß Regensburg", city: "Regensburg", stadium: "Sportpark Regensburg", capacity: 15210 },
        { id: "de2_elv", name: "Concordia Elversberg", city: "Elversberg", stadium: "Sportpark Elversberg", capacity: 10000 },
        { id: "de2_ulm", name: "Blau-Weiß Ulm", city: "Ulm", stadium: "Sportpark Ulm", capacity: 17000 }
    ],

    // -------------------------------------------------------- 3. Liga
    de_liga_3: [
        { id: "de3_sgd", name: "SSV Dresden", city: "Dresden", stadium: "Arena Dresden", capacity: 32066 },
        { id: "de3_han", name: "Blau-Weiß Rostock", city: "Rostock", stadium: "Arena Rostock", capacity: 29000 },
        { id: "de3_rwe", name: "VfR Essen", city: "Essen", stadium: "Arena Essen", capacity: 20650 },
        { id: "de3_ala", name: "Viktoria Aachen", city: "Aachen", stadium: "Arena Aachen", capacity: 32960 },
        { id: "de3_1860", name: "Viktoria München", city: "München", stadium: "Sportpark München", capacity: 15000 },
        { id: "de3_fcs", name: "TuS Saarbrücken", city: "Saarbrücken", stadium: "Sportpark Saarbrücken", capacity: 16003 },
        { id: "de3_cot", name: "Grün-Weiß Cottbus", city: "Cottbus", stadium: "Arena Cottbus", capacity: 22528 },
        { id: "de3_aue", name: "Germania Aue", city: "Aue", stadium: "Sportpark Aue", capacity: 16485 },
        { id: "de3_wal", name: "Viktoria Mannheim", city: "Mannheim", stadium: "Arena Mannheim", capacity: 25667 },
        { id: "de3_fci", name: "Teutonia Ingolstadt", city: "Ingolstadt", stadium: "Sportpark Ingolstadt", capacity: 15800 },
        { id: "de3_swv", name: "SG Wiesbaden", city: "Wiesbaden", stadium: "Sportpark Wiesbaden", capacity: 12566 },
        { id: "de3_hfc", name: "Blau-Weiß Halle", city: "Halle", stadium: "Sportpark Halle", capacity: 15057 },
        { id: "de3_svs", name: "Rot-Weiß Sandhausen", city: "Sandhausen", stadium: "Sportpark Sandhausen", capacity: 15414 },
        { id: "de3_vik", name: "DJK Köln", city: "Köln", stadium: "Sportpark Köln", capacity: 8343 },
        { id: "de3_spvu", name: "SSV Unterhaching", city: "Unterhaching", stadium: "Sportpark Unterhaching", capacity: 15053 },
        { id: "de3_ver", name: "SpVgg Verl", city: "Verl", stadium: "Sportpark Verl", capacity: 5153 },
        { id: "de3_fsv", name: "VfR Zwickau", city: "Zwickau", stadium: "Sportpark Zwickau", capacity: 10134 },
        { id: "de3_bvb2", name: "SpVgg Dortmund", city: "Dortmund", stadium: "Sportpark Dortmund", capacity: 9999 },
        { id: "de3_vfb2", name: "SpVgg Stuttgart", city: "Stuttgart", stadium: "Sportpark Stuttgart", capacity: 11000 },
        { id: "de3_hav", name: "VfR Garbsen", city: "Garbsen", stadium: "Sportpark Garbsen", capacity: 4000 }
    ],

    // ------------------------------------------------- Regionalliga West
    de_rl_west: [
        { id: "rlw_msv", name: "Concordia Duisburg", city: "Duisburg", stadium: "Arena Duisburg", capacity: 31500 },
        { id: "rlw_rwo", name: "SpVgg Oberhausen", city: "Oberhausen", stadium: "Arena Oberhausen", capacity: 21318 },
        { id: "rlw_wsv", name: "TuS Wuppertal", city: "Wuppertal", stadium: "Arena Wuppertal", capacity: 23000 },
        { id: "rlw_sfs", name: "TSV Siegen", city: "Siegen", stadium: "Sportpark Siegen", capacity: 18200 },
        { id: "rlw_fko", name: "Blau-Weiß Köln", city: "Köln", stadium: "Stadion Köln", capacity: 11748 },
        { id: "rlw_roed", name: "Sportfreunde Rödinghausen", city: "Rödinghausen", stadium: "Sportpark Rödinghausen", capacity: 5027 },
        { id: "rlw_boc", name: "SC Bocholt", city: "Bocholt", stadium: "Sportpark Bocholt", capacity: 7000 },
        { id: "rlw_lot", name: "DJK Lotte", city: "Lotte", stadium: "Sportpark Lotte", capacity: 10059 },
        { id: "rlw_gue", name: "Sportfreunde Gütersloh", city: "Gütersloh", stadium: "Sportpark Gütersloh", capacity: 6500 },
        { id: "rlw_wie", name: "Concordia Rheda-Wiedenbrück", city: "Rheda-Wiedenbrück", stadium: "Sportpark Rheda-Wiedenbrück", capacity: 5004 },
        { id: "rlw_bmg2", name: "SC Mönchengladbach", city: "Mönchengladbach", stadium: "Sportpark Mönchengladbach", capacity: 8000 },
        { id: "rlw_koe2", name: "SSV Köln", city: "Köln", stadium: "Waldstadion Köln", capacity: 5000 },
        { id: "rlw_f95_2", name: "VfR Düsseldorf", city: "Düsseldorf", stadium: "Sportpark Düsseldorf", capacity: 7000 },
        { id: "rlw_bgl", name: "DJK Bergisch Gladbach", city: "Bergisch Gladbach", stadium: "Sportpark Bergisch Gladbach", capacity: 6000 },
        { id: "rlw_rhe", name: "TuS Rheine", city: "Rheine", stadium: "Sportpark Rheine", capacity: 5000 },
        { id: "rlw_sche", name: "Union Schermbeck", city: "Schermbeck", stadium: "Sportpark Schermbeck", capacity: 3500 },
        { id: "rlw_scp2", name: "TSV Paderborn", city: "Paderborn", stadium: "Stadion Paderborn", capacity: 3000 },
        { id: "rlw_boev", name: "DJK Bövinghausen", city: "Dortmund", stadium: "Sportplatz Bövinghausen", capacity: 2000 }
    ],

    // ----------------------------------------------- Regionalliga Bayern
    de_rl_bayern: [
        { id: "rlb_wkr", name: "Viktoria Würzburg", city: "Würzburg", stadium: "Sportpark Würzburg", capacity: 13090 },
        { id: "rlb_sw05", name: "DJK Schweinfurt", city: "Schweinfurt", stadium: "Sportpark Schweinfurt", capacity: 15060 },
        { id: "rlb_bay", name: "FSV Bayreuth", city: "Bayreuth", stadium: "Arena Bayreuth", capacity: 21500 },
        { id: "rlb_bur", name: "Union Burghausen", city: "Burghausen", stadium: "Sportpark Burghausen", capacity: 12200 },
        { id: "rlb_fcb2", name: "SpVgg München", city: "München", stadium: "Stadion München", capacity: 2500 },
        { id: "rlb_tg", name: "Viktoria Heimstetten", city: "München", stadium: "Stadion Heimstetten", capacity: 2500 },
        { id: "rlb_ill", name: "SSV Illertissen", city: "Illertissen", stadium: "Sportpark Illertissen", capacity: 4500 },
        { id: "rlb_mem", name: "VfR Memmingen", city: "Memmingen", stadium: "Sportpark Memmingen", capacity: 4000 },
        { id: "rlb_fca2", name: "SpVgg Augsburg", city: "Augsburg", stadium: "Sportpark Augsburg", capacity: 3000 },
        { id: "rlb_fcn2", name: "SpVgg Valznerweiher", city: "Nürnberg", stadium: "Stadion Valznerweiher", capacity: 3000 },
        { id: "rlb_aub", name: "SG Aubstadt", city: "Aubstadt", stadium: "Stadion Aubstadt", capacity: 2500 },
        { id: "rlb_buch", name: "SC Buchbach", city: "Buchbach", stadium: "Stadion Buchbach", capacity: 3000 },
        { id: "rlb_vil", name: "Union Vilzing", city: "Cham", stadium: "Stadion Vilzing", capacity: 3000 },
        { id: "rlb_eic", name: "DJK Eichstätt", city: "Eichstätt", stadium: "Sportpark Eichstätt", capacity: 2000 },
        { id: "rlb_ans", name: "SSV Ansbach", city: "Ansbach", stadium: "Sportpark Ansbach", capacity: 3000 },
        { id: "rlb_hei", name: "VfR Heimstetten", city: "Kirchheim", stadium: "Waldstadion Heimstetten", capacity: 2500 },
        { id: "rlb_rai", name: "SSV Rain", city: "Rain", stadium: "Sportpark Rain", capacity: 2000 },
        { id: "rlb_don", name: "Germania Donaustauf", city: "Donaustauf", stadium: "Sportanlage Donaustauf", capacity: 2000 }
    ],

    // -------------------------------------------------------- Oberliga Nord
    de_ol_nord: [
        { id: "oln_vfb", name: "SpVgg Oldenburg", city: "Oldenburg", stadium: "Sportpark Oldenburg", capacity: 15200 },
        { id: "oln_wei", name: "SSV Flensburg", city: "Flensburg", stadium: "Sportpark Flensburg", capacity: 3000 },
        { id: "oln_nor", name: "FC Norderstedt", city: "Norderstedt", stadium: "Sportpark Norderstedt", capacity: 5000 },
        { id: "oln_alt", name: "SG Hamburg", city: "Hamburg", stadium: "Sportpark Hamburg", capacity: 6000 },
        { id: "oln_hsv2", name: "Blau-Weiß Hamburg", city: "Hamburg", stadium: "Stadion Hamburg", capacity: 2500 },
        { id: "oln_atl", name: "TuS Delmenhorst", city: "Delmenhorst", stadium: "Sportpark Delmenhorst", capacity: 5000 },
        { id: "oln_teu", name: "SpVgg Kreuzkirche", city: "Hamburg", stadium: "Sportplatz Kreuzkirche", capacity: 2000 },
        { id: "oln_bsv", name: "Teutonia Rehden", city: "Rehden", stadium: "Sportpark Rehden", capacity: 3000 },
        { id: "oln_hil", name: "Blau-Weiß Hildesheim", city: "Hildesheim", stadium: "Sportpark Hildesheim", capacity: 5000 },
        { id: "oln_bre", name: "VfR Bremen", city: "Bremen", stadium: "Sportpark Bremen", capacity: 5000 },
        { id: "oln_dro", name: "DJK Drochtersen", city: "Drochtersen", stadium: "Sportpark Drochtersen", capacity: 3000 },
        { id: "oln_loh", name: "SSV Lohne", city: "Lohne", stadium: "Sportpark Lohne", capacity: 3000 },
        { id: "oln_jed", name: "Viktoria Edewecht", city: "Edewecht", stadium: "Sportpark Edewecht", capacity: 2000 },
        { id: "oln_hei", name: "Sportfreunde Heide", city: "Heide", stadium: "Sportpark Heide", capacity: 2500 },
        { id: "oln_obe", name: "Sportfreunde Oberneuland", city: "Bremen", stadium: "Sportanlage Oberneuland", capacity: 3000 },
        { id: "oln_lup", name: "SV Elsterweg", city: "Wolfsburg", stadium: "Sportanlage Elsterweg", capacity: 2000 }
    ],

    // -------------------------------------------------------- Verbandsliga
    de_vl_1: [
        { id: "vl_gie", name: "SpVgg Gießen", city: "Gießen", stadium: "Sportpark Gießen", capacity: 10000 },
        { id: "vl_sta", name: "TSV Stadtallendorf", city: "Stadtallendorf", stadium: "Sportpark Stadtallendorf", capacity: 4000 },
        { id: "vl_dre", name: "Teutonia Dreieich", city: "Dreieich", stadium: "Stadion Dreieich", capacity: 4000 },
        { id: "vl_alz", name: "SSV Prischoß", city: "Alzenau", stadium: "Stadion Prischoß", capacity: 4000 },
        { id: "vl_wal", name: "VfR Waldgirmes", city: "Lahnau", stadium: "Stadion Waldgirmes", capacity: 2500 },
        { id: "vl_had", name: "FSV Hadamar", city: "Hadamar", stadium: "Sportpark Hadamar", capacity: 2500 },
        { id: "vl_gin", name: "Grün-Weiß Ginsheim-Gustavsburg", city: "Ginsheim-Gustavsburg", stadium: "Sportpark Ginsheim-Gustavsburg", capacity: 3000 },
        { id: "vl_ros", name: "Teutonia Rosenhöhe", city: "Offenbach", stadium: "Sportanlage Rosenhöhe", capacity: 3000 },
        { id: "vl_fli", name: "SC Flieden", city: "Flieden", stadium: "Sportgelände Flieden", capacity: 2000 },
        { id: "vl_leh", name: "Grün-Weiß Lehnerz", city: "Fulda", stadium: "Sportplatz Lehnerz", capacity: 2000 },
        { id: "vl_fer", name: "SSV Fernwald", city: "Fernwald", stadium: "Sportanlage Fernwald", capacity: 2000 },
        { id: "vl_die", name: "SC Dietkirchen", city: "Limburg", stadium: "Sportplatz Dietkirchen", capacity: 2000 },
        { id: "vl_ede", name: "SSV Battenberg", city: "Battenberg", stadium: "Sportplatz Battenberg", capacity: 2000 },
        { id: "vl_edd", name: "TuS Eddersheim", city: "Hattersheim", stadium: "Sportanlage Eddersheim", capacity: 2500 },
        { id: "vl_erl", name: "DJK Erlensee", city: "Erlensee", stadium: "Stadion Erlensee", capacity: 2000 },
        { id: "vl_bue", name: "Sportfreunde Büttelborn", city: "Büttelborn", stadium: "Sportanlage Büttelborn", capacity: 2000 }
    ],

    // ---------------------------------------------------------- Landesliga
    de_ll_1: [
        { id: "ll_han", name: "FSV Hanau", city: "Hanau", stadium: "Sportpark Hanau", capacity: 5000 },
        { id: "ll_vil", name: "FC Bad Vilbel", city: "Bad Vilbel", stadium: "Stadion Bad Vilbel", capacity: 3000 },
        { id: "ll_iso", name: "VfR Neu-Isenburg", city: "Neu-Isenburg", stadium: "Stadion Neu-Isenburg", capacity: 2500 },
        { id: "ll_wie", name: "Sportfreunde Rheinhöhe", city: "Wiesbaden", stadium: "Stadion Rheinhöhe", capacity: 3000 },
        { id: "ll_bru", name: "FSV Bruchköbel", city: "Bruchköbel", stadium: "Sportpark Bruchköbel", capacity: 2000 },
        { id: "ll_ber", name: "SC Bernbach", city: "Freigericht", stadium: "Sportanlage Bernbach", capacity: 2000 },
        { id: "ll_kel", name: "SSV Kelsterbach", city: "Kelsterbach", stadium: "Sportanlage Kelsterbach", capacity: 2000 },
        { id: "ll_spr", name: "FSV Sprendlingen", city: "Dreieich", stadium: "Sportanlage Sprendlingen", capacity: 2000 },
        { id: "ll_zei", name: "TSV Zeilsheim", city: "Frankfurt", stadium: "Sportanlage Zeilsheim", capacity: 2000 },
        { id: "ll_unt", name: "DJK Unterliederbach", city: "Frankfurt", stadium: "Sportanlage Unterliederbach", capacity: 2000 },
        { id: "ll_rie", name: "VfR Riedrode", city: "Bürstadt", stadium: "Sportanlage Riedrode", capacity: 2000 },
        { id: "ll_obe", name: "FSV Obertshausen", city: "Obertshausen", stadium: "Sportanlage Obertshausen", capacity: 2000 },
        { id: "ll_ege", name: "SpVgg Egelsbach", city: "Egelsbach", stadium: "Sportanlage Egelsbach", capacity: 2000 },
        { id: "ll_woe", name: "TSV Wörsdorf", city: "Idstein", stadium: "Sportanlage Wörsdorf", capacity: 1500 },
        { id: "ll_hoe", name: "VfR Höchst", city: "Höchst im Odenwald", stadium: "Sportgelände Höchst", capacity: 1500 },
        { id: "ll_kal", name: "DJK Kalbach", city: "Frankfurt", stadium: "Sportanlage Kalbach", capacity: 1500 }
    ]
};

if (typeof window !== "undefined") {
    window.REAL_CLUBS_BY_LEAGUE = REAL_CLUBS_BY_LEAGUE;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { REAL_CLUBS_BY_LEAGUE };
}
