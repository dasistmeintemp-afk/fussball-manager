/**
 * Länderspezifische Namens- und Städtepools.
 *
 * Werden von PlayerGenerator und WorldGenerator genutzt, damit ein spanischer
 * Erstligist spanische Spieler in spanischen Städten hat.
 */

const COUNTRY_NAME_POOLS = {
    de: {
        firstNames: ["Lukas", "Leon", "Finn", "Elias", "Jonas", "Felix", "Maximilian", "Noah", "Paul", "Julian", "Moritz", "Niklas", "David", "Tim", "Jan", "Tobias", "Alexander", "Simon", "Florian", "Fabian", "Marco", "Kevin", "Sebastian", "Marvin", "Nico", "Daniel", "Christian", "Marcel", "Dennis", "Robin", "Matteo", "Luca", "Jakob", "Emil", "Anton", "Ben", "Theo", "Mats", "Hannes", "Erik", "Tom", "Oskar", "Mika", "Rafael", "Jannik", "Philipp", "Lars", "Sven", "Malte", "Torben"],
        lastNames: ["Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner", "Becker", "Schulz", "Hoffmann", "Schäfer", "Koch", "Bauer", "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz", "Zimmermann", "Braun", "Krüger", "Hofmann", "Hartmann", "Lange", "Schmitt", "Werner", "Schmitz", "Krause", "Meier", "Lehmann", "Herrmann", "König", "Walter", "Mayer", "Huber", "Kaiser", "Fuchs", "Peters", "Lang", "Scholz", "Möller", "Jung", "Hahn", "Vogel", "Friedrich", "Günther", "Keller", "Berger", "Winkler"],
        nationalities: ["Deutschland", "Deutschland", "Deutschland", "Deutschland", "Deutschland", "Deutschland", "Österreich", "Schweiz", "Frankreich", "Niederlande", "Spanien", "Italien", "Brasilien", "Kroatien", "Polen", "Dänemark", "Türkei"],
        cities: ["München", "Berlin", "Hamburg", "Köln", "Frankfurt", "Stuttgart", "Leipzig", "Dortmund", "Essen", "Bremen", "Hannover", "Nürnberg", "Duisburg", "Bochum", "Wuppertal", "Bielefeld", "Bonn", "Münster", "Karlsruhe", "Mannheim", "Augsburg", "Wiesbaden", "Mönchengladbach", "Gelsenkirchen", "Braunschweig", "Kiel", "Chemnitz", "Halle", "Magdeburg", "Freiburg", "Krefeld", "Mainz", "Lübeck", "Erfurt", "Rostock", "Kassel", "Hagen", "Potsdam", "Saarbrücken", "Hamm", "Oldenburg", "Osnabrück", "Leverkusen", "Heidelberg", "Darmstadt", "Solingen", "Neuss", "Regensburg", "Paderborn", "Ingolstadt", "Offenbach", "Fürth", "Ulm", "Heilbronn", "Pforzheim", "Wolfsburg", "Göttingen", "Reutlingen", "Koblenz", "Jena", "Siegen", "Hildesheim", "Kaiserslautern", "Gütersloh", "Schwerin", "Witten", "Iserlohn", "Ludwigsburg", "Hanau", "Esslingen", "Zwickau", "Düren", "Tübingen", "Flensburg", "Gießen", "Worms", "Konstanz", "Minden", "Celle", "Aschaffenburg", "Kempten", "Landshut", "Bamberg", "Bayreuth", "Schweinfurt", "Passau", "Rosenheim", "Hof", "Coburg", "Weiden", "Amberg", "Ansbach", "Memmingen", "Verden", "Cuxhaven", "Emden", "Goslar", "Lingen", "Peine", "Stade", "Uelzen"],
        clubPrefixes: ["FC", "SV", "SC", "VfB", "SpVgg", "TuS", "TSV", "FV", "VfL", "1. FC", "Borussia", "Eintracht", "Viktoria", "Fortuna", "Union", "Rot-Weiß", "Blau-Weiß", "Teutonia", "Preußen", "Germania", "Concordia", "Hertha", "Alemannia", "Arminia", "Wacker"],
        stadiumSuffixes: ["-Stadion", "-Arena", "-Park", " Kampfbahn", " Sportpark", " Waldstadion", " Jahnstadion", " Am Stadtpark", " Sportanlage", " Bezirkssportanlage"]
    },
    en: {
        firstNames: ["Harry", "Jack", "Oliver", "George", "Charlie", "Jacob", "Thomas", "Oscar", "William", "James", "Ben", "Callum", "Reece", "Mason", "Declan", "Phil", "Jude", "Bukayo", "Marcus", "Jordan", "Kyle", "Aaron", "Conor", "Ollie", "Dominic", "Ethan", "Tyler", "Louie", "Freddie", "Alfie", "Archie", "Toby", "Ryan", "Lewis", "Connor", "Adam", "Nathan", "Joel", "Elliot", "Curtis", "Levi", "Tariq", "Kane", "Rico", "Morgan", "Sonny", "Bailey", "Finley", "Rhys", "Owen"],
        lastNames: ["Smith", "Jones", "Taylor", "Brown", "Williams", "Wilson", "Johnson", "Davies", "Robinson", "Wright", "Thompson", "Evans", "Walker", "White", "Roberts", "Green", "Hall", "Wood", "Jackson", "Clarke", "Turner", "Hughes", "Edwards", "Harris", "Cooper", "Ward", "Baker", "Morris", "King", "Bennett", "Foster", "Gray", "Bell", "Cox", "Marshall", "Palmer", "Rice", "Barnes", "Fletcher", "Reid", "Doyle", "Chambers", "Sterling", "Grealish", "Maddison", "Trippier", "Gallagher", "Colwill", "Ramsdale", "Shaw"],
        nationalities: ["England", "England", "England", "England", "England", "England", "Schottland", "Wales", "Irland", "Frankreich", "Brasilien", "Argentinien", "Portugal", "Niederlande", "Ghana", "Nigeria", "Norwegen"],
        cities: ["Manchester", "Liverpool", "Birmingham", "Leeds", "Sheffield", "Newcastle", "Nottingham", "Bristol", "Leicester", "Southampton", "Brighton", "Norwich", "Ipswich", "Coventry", "Sunderland", "Middlesbrough", "Blackburn", "Bolton", "Stoke", "Derby", "Preston", "Portsmouth", "Plymouth", "Hull", "Wolverhampton", "Watford", "Reading", "Luton", "Swindon", "Oxford", "Cambridge", "York", "Exeter", "Bournemouth", "Blackpool", "Burnley", "Rotherham", "Barnsley", "Wigan", "Millwall", "Fulham", "Brentford", "Charlton", "Peterborough", "Doncaster", "Northampton", "Colchester", "Gillingham", "Crewe", "Walsall"],
        clubPrefixes: ["", "", "", "", "", "", "", "AFC"],
        clubSuffixes: ["United", "City", "Town", "Rovers", "Athletic", "Wanderers", "Albion", "County", "Rangers", "FC"],
        stadiumSuffixes: [" Park", " Road", " Stadium", " Lane", " Ground", " Arena", " Bridge", " Meadow"]
    },
    es: {
        firstNames: ["Sergio", "Álvaro", "Pablo", "Javier", "Carlos", "Marcos", "Rodrigo", "Iker", "Mikel", "Unai", "Gerard", "Marc", "Pau", "Ferran", "Dani", "Iago", "Aitor", "Borja", "Rubén", "Óscar", "Nacho", "Fran", "Diego", "Adrián", "Raúl", "Jorge", "Hugo", "Bryan", "Yeremy", "Ansu", "Nico", "Gavi", "Álex", "Isco", "Koke", "Saúl", "Rodri", "Ander", "Iñaki", "Jesús", "Antonio", "Manuel", "José", "Juan", "Luis", "Miguel", "Alberto", "Víctor", "Roberto", "Samuel"],
        lastNames: ["García", "Rodríguez", "Martínez", "López", "Sánchez", "Pérez", "González", "Fernández", "Gómez", "Ruiz", "Díaz", "Moreno", "Álvarez", "Romero", "Torres", "Navarro", "Ramos", "Gil", "Serrano", "Blanco", "Molina", "Castro", "Ortega", "Rubio", "Marín", "Sanz", "Iglesias", "Medina", "Cortés", "Garrido", "Santos", "Vargas", "Herrera", "Peña", "Cabrera", "Flores", "Campos", "Vega", "Fuentes", "Carmona", "Reyes", "Aguilar", "Pardo", "Soler", "Bravo", "Nieto", "Lorenzo", "Vidal", "Casillas", "Llorente"],
        nationalities: ["Spanien", "Spanien", "Spanien", "Spanien", "Spanien", "Spanien", "Argentinien", "Brasilien", "Uruguay", "Kolumbien", "Portugal", "Marokko", "Frankreich", "Mexiko", "Chile", "Paraguay"],
        cities: ["Madrid", "Barcelona", "Valencia", "Sevilla", "Zaragoza", "Málaga", "Bilbao", "Murcia", "Palma", "Las Palmas", "Alicante", "Córdoba", "Valladolid", "Vigo", "Gijón", "Granada", "Vitoria", "A Coruña", "Elche", "Oviedo", "Badalona", "Cartagena", "Terrassa", "Jerez", "Sabadell", "Móstoles", "Santa Cruz", "Pamplona", "Almería", "Alcalá", "San Sebastián", "Getafe", "Burgos", "Albacete", "Santander", "Castellón", "Logroño", "Badajoz", "Salamanca", "Huelva", "Lleida", "Tarragona", "León", "Cádiz", "Jaén", "Ourense", "Girona", "Lugo", "Cáceres", "Melilla"],
        clubPrefixes: ["Real", "Atlético", "Deportivo", "CD", "CF", "UD", "RC", "Sporting", "Racing", "Club"],
        stadiumSuffixes: [" Estadio", " Coliseum", " Municipal", " Arena", " La Rosaleda", " El Molinón", " Nuevo Campo"]
    },
    it: {
        firstNames: ["Marco", "Alessandro", "Lorenzo", "Matteo", "Andrea", "Francesco", "Giovanni", "Luca", "Davide", "Simone", "Nicolò", "Federico", "Riccardo", "Gianluca", "Stefano", "Antonio", "Giuseppe", "Salvatore", "Emanuele", "Fabio", "Manuel", "Sandro", "Giacomo", "Tommaso", "Filippo", "Mattia", "Samuele", "Cristian", "Daniele", "Michele", "Alberto", "Enrico", "Roberto", "Massimo", "Vincenzo", "Domenico", "Raffaele", "Pietro", "Paolo", "Gabriele", "Edoardo", "Leonardo", "Alessio", "Nicola", "Diego", "Sergio", "Claudio", "Bryan", "Wilfried", "Moise"],
        lastNames: ["Rossi", "Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "De Luca", "Mancini", "Costa", "Giordano", "Rizzo", "Lombardi", "Moretti", "Barbieri", "Fontana", "Santoro", "Mariani", "Rinaldi", "Caruso", "Ferrara", "Galli", "Martini", "Leone", "Longo", "Gentile", "Martinelli", "Vitale", "Lombardo", "Serra", "Coppola", "De Santis", "Marchetti", "Parisi", "Villa", "Conte", "Ferretti", "Bianco", "Marini", "Grasso", "Valentini", "Messina", "Sala", "Verratti"],
        nationalities: ["Italien", "Italien", "Italien", "Italien", "Italien", "Italien", "Argentinien", "Brasilien", "Frankreich", "Serbien", "Kroatien", "Albanien", "Niederlande", "Polen", "Senegal", "Marokko"],
        cities: ["Milano", "Roma", "Napoli", "Torino", "Firenze", "Genova", "Bologna", "Bergamo", "Verona", "Udine", "Cagliari", "Palermo", "Bari", "Venezia", "Parma", "Empoli", "Salerno", "Lecce", "Sassuolo", "Brescia", "Catania", "Reggio", "Perugia", "Pescara", "Ancona", "Livorno", "Modena", "Cremona", "Como", "Vicenza", "Ferrara", "Trieste", "Padova", "Terni", "Frosinone", "Monza", "Pisa", "Cesena", "Spezia", "Benevento", "Avellino", "Foggia", "Taranto", "Cosenza", "Crotone", "Trapani", "Alessandria", "Novara", "Pordenone", "Latina"],
        clubPrefixes: ["AC", "AS", "US", "FC", "SS", "Calcio", "Atalanta", "Inter", "Real", "Virtus"],
        stadiumSuffixes: [" Stadio", " Arena", " Comunale", " Olimpico", " Marassi", " Del Duca", " Città"]
    },
    fr: {
        firstNames: ["Kylian", "Antoine", "Olivier", "Hugo", "Lucas", "Théo", "Jules", "Benjamin", "Raphaël", "Adrien", "Ousmane", "Marcus", "Randal", "Aurélien", "Eduardo", "Youssouf", "Ibrahima", "Dayot", "Mattéo", "Enzo", "Warren", "Manu", "Nordi", "Wesley", "Bradley", "Axel", "Nathan", "Maxime", "Florian", "Kévin", "Romain", "Thomas", "Nicolas", "Julien", "Clément", "Baptiste", "Quentin", "Corentin", "Valentin", "Alexis", "Rémi", "Gaëtan", "Loïc", "Yannick", "Sébastien", "Pierre", "Paul", "Louis", "Arthur", "Gabriel"],
        lastNames: ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau", "Simon", "Laurent", "Lefebvre", "Michel", "Garcia", "David", "Bertrand", "Roux", "Vincent", "Fournier", "Morel", "Girard", "André", "Lefèvre", "Mercier", "Dupont", "Lambert", "Bonnet", "François", "Martinez", "Legrand", "Garnier", "Faure", "Rousseau", "Blanc", "Guerin", "Muller", "Henry", "Roussel", "Nicolas", "Perrin", "Morin", "Mathieu", "Clement", "Gauthier", "Dumont", "Lopez", "Fontaine", "Chevalier", "Robin"],
        nationalities: ["Frankreich", "Frankreich", "Frankreich", "Frankreich", "Frankreich", "Frankreich", "Senegal", "Elfenbeinküste", "Mali", "Algerien", "Marokko", "Kamerun", "Brasilien", "Argentinien", "Portugal", "Belgien"],
        cities: ["Paris", "Marseille", "Lyon", "Toulouse", "Nice", "Nantes", "Montpellier", "Strasbourg", "Bordeaux", "Lille", "Rennes", "Reims", "Saint-Étienne", "Le Havre", "Toulon", "Grenoble", "Dijon", "Angers", "Nîmes", "Clermont", "Brest", "Metz", "Auxerre", "Lorient", "Caen", "Troyes", "Amiens", "Nancy", "Sochaux", "Guingamp", "Ajaccio", "Bastia", "Valenciennes", "Niort", "Orléans", "Tours", "Pau", "Annecy", "Chambéry", "Béziers", "Perpignan", "Avignon", "Limoges", "Poitiers", "La Rochelle", "Rouen", "Dunkerque", "Roubaix", "Cannes", "Sète"],
        clubPrefixes: ["FC", "AS", "Olympique", "Racing", "Stade", "US", "SC", "RC", "Paris", "Union"],
        stadiumSuffixes: [" Stade", " Parc", " Arena", " Municipal", " Vélodrome", " Bollaert", " Beaujoire"]
    },
    nl: {
        firstNames: ["Daan", "Sem", "Lucas", "Milan", "Levi", "Luuk", "Bram", "Thijs", "Jesse", "Stijn", "Tim", "Ruben", "Niels", "Jasper", "Joey", "Kevin", "Bart", "Wout", "Jens", "Tijn", "Noah", "Finn", "Mats", "Sven", "Rick", "Dirk", "Jurre", "Teun", "Quinten", "Calvin", "Xander", "Ryan", "Brian", "Jordy", "Mitchell", "Davy", "Joost", "Kenneth", "Ian", "Lars"],
        lastNames: ["de Jong", "Jansen", "de Vries", "van den Berg", "van Dijk", "Bakker", "Visser", "Smit", "Meijer", "de Boer", "Mulder", "de Groot", "Bos", "Vos", "Peters", "Hendriks", "van Leeuwen", "Dekker", "Brouwer", "de Wit", "Dijkstra", "Smits", "de Graaf", "van der Meer", "Kok", "Jacobs", "de Haan", "Vermeulen", "van der Linden", "Willems", "Verhoeven", "Koster", "Prins", "Huisman", "Kuipers", "Veenstra", "Timmermans", "Postma", "Bosman", "Hoekstra"],
        nationalities: ["Niederlande", "Niederlande", "Niederlande", "Niederlande", "Niederlande", "Niederlande", "Belgien", "Marokko", "Suriname", "Dänemark", "Norwegen", "Deutschland", "Curaçao", "Japan", "Brasilien", "Schweden"],
        cities: ["Amsterdam", "Rotterdam", "Den", "Haag", "Utrecht", "Eindhoven", "Groningen", "Tilburg", "Almere", "Breda", "Nijmegen", "Apeldoorn", "Haarlem", "Arnhem", "Enschede", "Amersfoort", "Zaanstad", "Maastricht", "Leiden", "Dordrecht", "Zoetermeer", "Zwolle", "Deventer", "Delft", "Alkmaar", "Heerlen", "Venlo", "Leeuwarden", "Helmond", "Oss", "Emmen", "Hengelo", "Roosendaal", "Velsen", "Sittard"],
        clubPrefixes: ["FC", "SV", "VV", "SC", "VVV", "Sportclub", "Eendracht", "Quick", "Velocitas"],
        stadiumSuffixes: [" Stadion", " Park", " Sportpark", " Arena"]
    },
    pt: {
        firstNames: ["João", "Rúben", "Diogo", "Bruno", "Bernardo", "Rafael", "Gonçalo", "Tiago", "Pedro", "Francisco", "Nuno", "André", "Ricardo", "Vítor", "Octávio", "Renato", "Rui", "Hugo", "Miguel", "Fábio", "Tomás", "Martim", "Duarte", "Rodrigo", "Leonardo", "Gustavo", "Henrique", "Samuel", "Simão", "Danilo"],
        lastNames: ["Silva", "Santos", "Ferreira", "Pereira", "Oliveira", "Costa", "Rodrigues", "Martins", "Jesus", "Sousa", "Fernandes", "Gonçalves", "Gomes", "Lopes", "Marques", "Alves", "Almeida", "Ribeiro", "Pinto", "Carvalho", "Teixeira", "Moreira", "Correia", "Mendes", "Nunes", "Soares", "Vieira", "Monteiro", "Cardoso", "Rocha", "Neves", "Coelho", "Cruz", "Cunha", "Pires", "Ramos", "Reis", "Simões", "Antunes", "Matos"],
        nationalities: ["Portugal", "Portugal", "Portugal", "Portugal", "Portugal", "Portugal", "Brasilien", "Brasilien", "Kap", "Verde", "Angola", "Spanien", "Uruguay", "Kolumbien", "Argentinien", "Senegal", "Ghana"],
        cities: ["Lisboa", "Porto", "Braga", "Coimbra", "Funchal", "Setúbal", "Aveiro", "Viseu", "Leiria", "Faro", "Guimarães", "Évora", "Barcelos", "Famalicão", "Vila", "Real", "Bragança", "Covilhã", "Chaves", "Portimão", "Penafiel", "Tondela", "Paços", "de", "Ferreira", "Feirense", "Póvoa", "de", "Varzim", "Oliveira", "Torres", "Vedras", "Amadora", "Almada", "Sintra", "Matosinhos"],
        clubPrefixes: ["FC", "SC", "CD", "Desportivo", "Atlético", "União", "Clube", "Académico"],
        stadiumSuffixes: [" Estádio", " Municipal", " Arena"]
    },
    be: {
        firstNames: ["Lucas", "Arthur", "Louis", "Jules", "Noah", "Liam", "Victor", "Mathis", "Benoît", "Kevin", "Kevin", "Nathan", "Axel", "Youri", "Leandro", "Hans", "Dries", "Jan", "Wout", "Thomas", "Maxime", "Arnaud", "Simon", "Siebe", "Bram", "Sander", "Jelle", "Lander", "Charles", "Hugo"],
        lastNames: ["Peeters", "Janssens", "Maes", "Jacobs", "Mertens", "Willems", "Claes", "Goossens", "Wouters", "De Smet", "Dubois", "Lambert", "Dupont", "Martin", "Vermeulen", "Hermans", "Michiels", "Desmet", "Lemmens", "Pauwels", "Aerts", "Vandenberghe", "Van Damme", "Lemaire", "Leclercq", "Coppens", "Verbeke", "Moens", "Mbuyi", "Kabongo"],
        nationalities: ["Belgien", "Belgien", "Belgien", "Belgien", "Belgien", "Belgien", "Frankreich", "Niederlande", "DR", "Kongo", "Marokko", "Kamerun", "Ghana", "Nigeria", "Japan", "Dänemark", "Elfenbeinküste"],
        cities: ["Antwerpen", "Gent", "Charleroi", "Lüttich", "Brüssel", "Brugge", "Namur", "Löwen", "Mons", "Aalst", "Mechelen", "Kortrijk", "Hasselt", "Ostende", "Sint-Niklaas", "Tournai", "Genk", "Seraing", "Roeselare", "Verviers", "Mouscron", "Beveren", "Lokeren", "Lommel", "Waregem", "Eupen", "Tubize", "Virton", "Deinze", "Knokke"],
        clubPrefixes: ["KV", "RFC", "SK", "KSV", "RSC", "FC", "Sporting", "Royal"],
        stadiumSuffixes: [" Stadion", " Stade", " Park"]
    },
    tr: {
        firstNames: ["Arda", "Kerem", "Hakan", "Çağlar", "Mert", "Burak", "Emre", "Ozan", "Cengiz", "Yusuf", "Barış", "İrfan", "Okay", "Ferhat", "Zeki", "Abdullah", "Merih", "Kaan", "Uğur", "Altay", "Semih", "Oğuz", "Salih", "Ahmet", "Mehmet", "Mustafa", "Ali", "Can", "Enes", "Berkan"],
        lastNames: ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Yıldırım", "Öztürk", "Aydın", "Özdemir", "Arslan", "Doğan", "Kılıç", "Aslan", "Çetin", "Kara", "Koç", "Kurt", "Özkan", "Şimşek", "Polat", "Korkmaz", "Erdoğan", "Güler", "Akgün", "Karaca", "Avcı", "Bulut", "Taş", "Akın"],
        nationalities: ["Türkei", "Türkei", "Türkei", "Türkei", "Türkei", "Türkei", "Türkei", "Deutschland", "Brasilien", "Portugal", "Nigeria", "Senegal", "Niederlande", "Bosnien-Herzegowina", "Kroatien", "Ghana"],
        cities: ["Istanbul", "Ankara", "Izmir", "Bursa", "Adana", "Gaziantep", "Konya", "Antalya", "Kayseri", "Mersin", "Eskişehir", "Diyarbakır", "Samsun", "Denizli", "Şanlıurfa", "Malatya", "Trabzon", "Erzurum", "Sakarya", "Kocaeli", "Manisa", "Sivas", "Balıkesir", "Rize", "Bodrum", "Alanya", "Bolu", "Giresun", "Ordu", "Hatay"],
        clubPrefixes: ["SK", "Gücü", "Spor", "Belediyespor", "Gençlik", "İdmanyurdu"],
        stadiumSuffixes: [" Stadı", " Arena"]
    },
    at: {
        firstNames: ["Lukas", "David", "Florian", "Tobias", "Maximilian", "Julian", "Stefan", "Marcel", "Christoph", "Philipp", "Konrad", "Nicolas", "Marko", "Alexander", "Michael", "Patrick", "Dominik", "Matthias", "Raphael", "Kevin", "Valentin", "Sebastian", "Andreas", "Moritz", "Elias", "Felix", "Leon", "Jakob", "Simon", "Paul"],
        lastNames: ["Gruber", "Huber", "Bauer", "Wagner", "Müller", "Pichler", "Steiner", "Moser", "Mayer", "Hofer", "Leitner", "Berger", "Fuchs", "Eder", "Fischer", "Schmid", "Winkler", "Weber", "Schwarz", "Maier", "Schneider", "Reiter", "Mayr", "Schmidt", "Wimmer", "Egger", "Brunner", "Lang", "Baumgartner", "Auer"],
        nationalities: ["Österreich", "Österreich", "Österreich", "Österreich", "Österreich", "Österreich", "Deutschland", "Kroatien", "Serbien", "Bosnien-Herzegowina", "Slowenien", "Ungarn", "Schweiz", "Brasilien", "Ghana", "Mali"],
        cities: ["Wien", "Graz", "Linz", "Salzburg", "Innsbruck", "Klagenfurt", "Villach", "Wels", "St. Pölten", "Dornbirn", "Wiener Neustadt", "Steyr", "Feldkirch", "Bregenz", "Leoben", "Wolfsberg", "Krems", "Traun", "Amstetten", "Lustenau", "Kapfenberg", "Hartberg", "Ried", "Horn", "Leonding", "Kufstein", "Bad Ischl", "Spittal", "Lienz", "Altach"],
        clubPrefixes: ["SK", "SV", "FC", "ASK", "SC", "Austria", "Union", "ATSV"],
        stadiumSuffixes: ["-Stadion", " Arena", " Sportpark"]
    },
    ch: {
        firstNames: ["Noah", "Luca", "Leon", "Levin", "Nico", "Fabian", "Yann", "Kevin", "Ricardo", "Valon", "Marco", "Manuel", "Remo", "Silvan", "Cedric", "Denis", "Ruben", "Lionel", "Dan", "Gregor", "Michel", "Jonas", "Joel", "Samuel", "Loris", "Elia", "Matteo", "Gabriel", "Théo", "Mathis"],
        lastNames: ["Müller", "Meier", "Schmid", "Keller", "Weber", "Huber", "Schneider", "Meyer", "Steiner", "Fischer", "Gerber", "Brunner", "Baumann", "Frei", "Zimmermann", "Moser", "Widmer", "Wyss", "Graf", "Roth", "Favre", "Bonvin", "Rochat", "Rossi", "Bernasconi", "Krasniqi", "Berisha", "Hofstetter", "Lüthi", "Ndiaye"],
        nationalities: ["Schweiz", "Schweiz", "Schweiz", "Schweiz", "Schweiz", "Schweiz", "Kosovo", "Frankreich", "Deutschland", "Italien", "Portugal", "Serbien", "Kamerun", "Elfenbeinküste", "Spanien", "Österreich"],
        cities: ["Zürich", "Genf", "Basel", "Lausanne", "Bern", "Winterthur", "Luzern", "St. Gallen", "Lugano", "Biel", "Thun", "Köniz", "La Chaux-de-Fonds", "Schaffhausen", "Freiburg im Üechtland", "Chur", "Neuenburg", "Sitten", "Aarau", "Wil", "Bellinzona", "Yverdon", "Baden", "Kriens", "Vaduz", "Locarno", "Solothurn", "Olten", "Wettingen", "Uster"],
        clubPrefixes: ["FC", "SC", "BSC", "AC", "FC", "Sportclub", "Concordia", "Juventus"],
        stadiumSuffixes: [" Stadion", " Stade", " Stadio"]
    },
    sc: {
        firstNames: ["Andrew", "John", "Scott", "Callum", "Kieran", "Ryan", "Stuart", "Ross", "Grant", "Craig", "Liam", "Lewis", "Jamie", "Kyle", "Billy", "Graeme", "Jack", "Nathan", "Calum", "Fraser", "Euan", "Ewan", "Murray", "Angus", "Gregor", "Hamish", "Cameron", "Robbie", "Declan", "Connor"],
        lastNames: ["Ritchie", "McLean", "McKay", "Docherty", "Cairns", "Kerr", "Adams", "McGregor", "Armstrong", "Hunter", "Bain", "Wallace", "Fraser", "Ferguson", "Gordon", "Clark", "Boyle", "McIntosh", "Cooper", "Taylor", "Campbell", "Stewart", "Anderson", "MacDonald", "Scott", "Reid", "Murray", "Paterson", "Mitchell", "Ross"],
        nationalities: ["Schottland", "Schottland", "Schottland", "Schottland", "Schottland", "Schottland", "England", "Irland", "Nordirland", "Wales", "Australien", "Norwegen", "Kanada", "Japan", "Nigeria", "Dänemark"],
        cities: ["Glasgow", "Edinburgh", "Aberdeen", "Dundee", "Inverness", "Perth", "Stirling", "Paisley", "Kilmarnock", "Motherwell", "Falkirk", "Ayr", "Livingston", "Hamilton", "Greenock", "Dunfermline", "Kirkcaldy", "Arbroath", "Montrose", "Dumfries", "Airdrie", "Cowdenbeath", "Alloa", "Forfar", "Peterhead", "Elgin", "Stranraer", "Dingwall", "Brechin", "Coatbridge"],
        clubPrefixes: ["", "", "", "", "Royal", "City of"],
        clubSuffixes: ["FC", "Athletic", "Rovers", "Thistle", "United", "City", "Academicals", "Wanderers"],
        stadiumSuffixes: [" Park", " Road", " Stadium", " Ground"]
    },
    br: {
        firstNames: ["Gabriel", "Lucas", "Matheus", "Pedro", "Vinícius", "Rodrigo", "Gustavo", "Thiago", "Bruno", "Rafael", "Felipe", "João", "Igor", "Breno", "Rafinha", "Ricardo", "Carlos", "Marcos", "Danilo", "Éder", "Wesley", "Luiz", "Douglas", "Gerson", "Arthur", "André", "Caio", "Kaio", "Murilo", "Savinho"],
        lastNames: ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira", "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes", "Soares", "Fernandes", "Vieira", "Barbosa", "Rocha", "Dias", "Nascimento", "Andrade", "Moreira", "Nunes", "Marques", "Machado", "Mendes", "Freitas"],
        nationalities: ["Brasilien", "Brasilien", "Brasilien", "Brasilien", "Brasilien", "Brasilien", "Brasilien", "Brasilien", "Argentinien", "Uruguay", "Kolumbien", "Paraguay", "Chile", "Ecuador", "Venezuela", "Peru"],
        cities: ["Rio de Janeiro", "São Paulo", "Belo Horizonte", "Porto Alegre", "Salvador", "Recife", "Fortaleza", "Curitiba", "Goiânia", "Belém", "Manaus", "Florianópolis", "Campinas", "Santos", "Natal", "Maceió", "João Pessoa", "Cuiabá", "Ribeirão Preto", "Londrina", "Joinville", "Juiz de Fora", "Caxias do Sul", "Sorocaba", "Chapecó", "Criciúma", "Bragança Paulista", "Novo Horizonte", "Itu", "Volta Redonda"],
        clubPrefixes: ["EC", "SC", "FC", "Esporte", "Clube", "Atlético", "Sociedade", "Grêmio", "Associação"],
        stadiumSuffixes: [" Estádio", " Arena", " Municipal"]
    }
};

if (typeof window !== "undefined") {
    window.COUNTRY_NAME_POOLS = COUNTRY_NAME_POOLS;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { COUNTRY_NAME_POOLS };
}
