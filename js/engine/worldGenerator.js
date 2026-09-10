/**
 * WorldGenerator - Baut die komplette Fußballwelt auf
 *
 * Aus den Ligadefinitionen entsteht eine Welt mit den fünf großen
 * europäischen Erstligen und der deutschen Pyramide hinunter bis zur
 * Landesliga. Jeder Verein bekommt einen eigenen Kader, dessen Stärke sich
 * nach Ligastufe und Ruf des Vereins richtet: Ein Landesligist spielt mit
 * Spielern um 20 Gesamtstärke, ein Bundesliga-Spitzenklub um 80.
 */

const _wgResolve = (globalName, path, exportName) => {
    if (typeof globalThis !== "undefined" && globalThis[globalName]) return globalThis[globalName];
    if (typeof window !== "undefined" && window[globalName]) return window[globalName];
    if (typeof require !== "undefined") {
        try { return require(path)[exportName || globalName]; } catch (e) { return null; }
    }
    return null;
};

class WorldGenerator {
    /** Kadergröße nach Ligastufe - Amateure haben kleinere Kader */
    static SQUAD_SIZES = { 1: 24, 2: 22, 3: 21, 4: 20, 5: 19, 6: 19, 7: 19 };

    /**
     * Harte Untergrenzen, ohne die eine Mannschaft nicht spielfähig ist.
     * Nicht der Sollplan, sondern das Existenzminimum: Wer darunter fällt,
     * bekommt Nachschub, auch wenn der Kader zahlenmäßig voll ist.
     */
    static MINDESTBESETZUNG = [
        { positionen: ["TW"], anzahl: 2, ersatz: "TW" },
        { positionen: ["IV"], anzahl: 3, ersatz: "IV" },
        { positionen: ["LV", "RV"], anzahl: 2, ersatz: "LV" },
        { positionen: ["ZM", "DM", "OM", "LM", "RM"], anzahl: 4, ersatz: "ZM" },
        { positionen: ["ST", "LA", "RA"], anzahl: 3, ersatz: "ST" }
    ];

    /** Welche Positionen fehlen dem Kader, um überhaupt spielfähig zu sein? */
    static fehlendeMindestbesetzung(ist) {
        const offen = [];
        this.MINDESTBESETZUNG.forEach(regel => {
            const vorhanden = regel.positionen.reduce((summe, pos) => summe + (ist[pos] || 0), 0);
            for (let i = vorhanden; i < regel.anzahl; i++) offen.push(regel.ersatz);
        });
        return offen;
    }

    /** Die Mannschaftsteil-Regel, zu der eine Position gehört */
    static gruppeZu(pos) {
        return this.MINDESTBESETZUNG.find(regel => regel.positionen.includes(pos)) || null;
    }

    /** Wie viele Spieler stellt der Kader in diesem Mannschaftsteil? */
    static gruppenStaerke(ist, regel) {
        if (!regel) return 99;
        return regel.positionen.reduce((summe, pos) => summe + (ist[pos] || 0), 0);
    }

    static getLeagues() {
        return _wgResolve("LEAGUES_DATA", "../data/leagueData.js", "LEAGUES_DATA") || [];
    }

    static getCountries() {
        return _wgResolve("COUNTRIES_DATA", "../data/leagueData.js", "COUNTRIES_DATA") || [];
    }

    static getClubGenerator() {
        return _wgResolve("ClubGenerator", "./clubGenerator.js", "ClubGenerator");
    }

    static getPlayerGenerator() {
        return _wgResolve("PlayerGenerator", "./playerGenerator.js", "PlayerGenerator");
    }

    static getGameState() {
        return _wgResolve("GameState", "./gameState.js", "GameState");
    }

    /**
     * Ordnet den bereits vorhandenen (handgepflegten) Vereinen ihre Liga zu
     * und leitet aus ihrem Ruf eine Stärkeposition innerhalb der Liga ab.
     */
    static tagExistingClubs(clubs, leagueId = "de_liga_1") {
        const league = this.getLeagues().find(l => l.id === leagueId);
        const country = this.getCountries().find(c => c.id === (league?.countryId || "de"));
        if (!clubs || clubs.length === 0) return clubs;

        const reputations = clubs.map(c => c.reputation || 60);
        const minRep = Math.min(...reputations);
        const maxRep = Math.max(...reputations);
        const span = Math.max(1, maxRep - minRep);

        clubs.forEach(club => {
            club.leagueId = club.leagueId || leagueId;
            club.level = club.level || league?.level || 1;
            club.countryId = club.countryId || league?.countryId || "de";
            club.tier = club.tier || (club.level <= 3 ? "professional" : club.level <= 4 ? "semi-pro" : "amateur");
            club.clubStrength = ((club.reputation || 60) - minRep) / span;
            if (club.stadiumCapacity === undefined) club.stadiumCapacity = club.capacity || 30000;
        });

        if (country && league) league.countryReputation = country.reputation;
        return clubs;
    }

    /**
     * Erzeugt alle fehlenden Vereine samt Kadern.
     *
     * @param {Object} state Spielstand mit clubs[] und players[]
     * @param {Object} options { skipLeagueIds: [] } - Ligen, die bereits gefüllt sind
     */
    static generateWorld(state, options = {}) {
        const leagues = this.getLeagues();
        const countries = this.getCountries();
        const clubGen = this.getClubGenerator();
        const playerGen = this.getPlayerGenerator();

        if (!clubGen || !playerGen || leagues.length === 0) {
            return { clubsCreated: 0, playersCreated: 0 };
        }

        if (!Array.isArray(state.clubs)) state.clubs = [];
        if (!Array.isArray(state.players)) state.players = [];

        const usedNames = new Set(state.clubs.map(c => c.name));
        const usedCities = new Set(state.clubs.map(c => c.city).filter(Boolean));

        let clubsCreated = 0;
        let playersCreated = 0;

        leagues.forEach(league => {
            const existing = state.clubs.filter(c => c.leagueId === league.id);
            const missing = (league.teamCount || 18) - existing.length;
            const country = countries.find(c => c.id === league.countryId);

            if (missing <= 0) return;

            const newClubs = clubGen.generateClubsForLeague(league, missing, {
                usedNames,
                usedCities,
                startIndex: existing.length,
                countryReputation: country ? country.reputation : 88
            });

            newClubs.forEach((club, idx) => {
                // Stärkeposition innerhalb der Liga für den Kaderaufbau merken
                const total = league.teamCount || 18;
                const rank = existing.length + idx;
                club.clubStrength = total > 1 ? Math.max(0, Math.min(1, 1 - rank / (total - 1))) : 0.5;

                const squad = playerGen.generateSquad(
                    club.id,
                    league.level || 1,
                    this.SQUAD_SIZES[league.level] || 18,
                    { clubStrength: club.clubStrength, countryId: league.countryId || "de", idOffset: 0 }
                );

                squad.forEach(player => {
                    state.players.push(player);
                    club.playerIds.push(player.id);
                });
                playersCreated += squad.length;

                const gameState = this.getGameState();
                if (gameState && typeof gameState.autoSetLineupForClub === "function") {
                    gameState.autoSetLineupForClub(club, state.players);
                }

                state.clubs.push(club);
                clubsCreated++;
            });
        });

        playersCreated += this.fillUpExistingSquads(state, leagues, playerGen);

        return { clubsCreated, playersCreated };
    }

    /**
     * Bestehende Vereine auf Ligagröße auffüllen.
     *
     * Die von Hand gepflegten Bundesligisten kamen mit sechzehn Spielern zur
     * Welt - weniger als jeder Landesligist - und standen nach der ersten
     * Verletzung ohne Ersatz da. Ergänzt wird gezielt dort, wo der Kader dünn
     * ist: Wer keinen zweiten Torwart hat, bekommt einen, und nicht noch einen
     * vierten Innenverteidiger.
     */
    static fillUpExistingSquads(state, leagues, playerGen, options = {}) {
        let erzeugt = 0;
        const gameState = this.getGameState();
        // Der Nutzerverein darf eine kleinere Zielgröße bekommen: Er soll seine
        // Lücken selbst auf dem Transfermarkt schließen dürfen.
        const zielGroesse = typeof options.sizeFor === "function" ? options.sizeFor : null;

        state.clubs.forEach(club => {
            const league = leagues.find(l => l.id === club.leagueId);
            if (!league) return;

            const voll = this.SQUAD_SIZES[league.level] || 18;
            const ziel = zielGroesse ? zielGroesse(club, voll) : voll;
            const kader = (club.playerIds || [])
                .map(id => state.players.find(sp => sp.id === id))
                .filter(Boolean);

            // Was fehlt dem Kader? Sollplan gegen Istbestand halten.
            const ist = {};
            kader.forEach(p => { ist[p.pos] = (ist[p.pos] || 0) + 1; });

            const rest = Object.assign({}, ist);
            const offen = [];
            playerGen.buildSquadPlan(ziel).forEach(pos => {
                if ((rest[pos] || 0) > 0) rest[pos]--;
                else offen.push(pos);
            });

            // Manche Lücken tun weh, auch wenn der Kader zahlenmäßig voll ist:
            // Ein Verein ohne zweiten Torwart oder ohne Stürmer läuft sonst
            // Saison für Saison mit einem Feldspieler im Tor auf.
            const kritisch = this.fehlendeMindestbesetzung(ist);
            const luecken = ziel - kader.length;

            // Jeder Verein zieht Jahr für Jahr Talente nach. Ohne diesen
            // Nachwuchs altert die Spielwelt Saison für Saison weiter, bis es
            // in der ganzen Liga keinen einzigen Zwanzigjährigen mehr gibt.
            const mindestJugend = options.mindestJugend || 0;
            const jung = kader.filter(p => (p.age || 25) <= 21).length;
            const jugendLuecke = Math.max(0, mindestJugend - jung);

            const anzahl = Math.max(luecken, kritisch.length, jugendLuecke);
            if (anzahl <= 0) return;

            // Die dünnsten Mannschaftsteile zuerst bedienen - sonst bekommt ein
            // Verein mit zwei Stürmern erst einmal den vierten Innenverteidiger,
            // weil die Angreifer im Sollplan hinten stehen.
            const knappheit = (pos) => {
                const regel = this.gruppeZu(pos);
                if (!regel) return 9;
                return this.gruppenStaerke(ist, regel) / regel.anzahl;
            };
            const wunsch = kritisch.concat(offen.slice().sort((a, b) => knappheit(a) - knappheit(b)));
            while (wunsch.length < anzahl) wunsch.push("ZM");

            // Ist der Kader schon voll, macht der schwächste Überzählige Platz -
            // er wird vereinslos und steht dem Transfermarkt zur Verfügung.
            // Wer für die Mindestbesetzung gebraucht wird, bleibt tabu.
            let ueberzaehlig = kader.length + anzahl - ziel;
            if (ueberzaehlig > 0) {
                const gruppe = {};
                Object.keys(ist).forEach(pos => {
                    const regel = this.gruppeZu(pos);
                    if (regel && gruppe[regel.ersatz] === undefined) {
                        gruppe[regel.ersatz] = this.gruppenStaerke(ist, regel) - regel.anzahl;
                    }
                });

                // Wer gehen muss: der schwächste Überzählige, wobei ein
                // Routinier jenseits der Dreißig eher weicht als ein Talent
                const wert = (p) => (p.overall || 0) - Math.max(0, (p.age || 25) - 29) * 4;
                const ueberhang = kader
                    .filter(p => (rest[p.pos] || 0) > 0)
                    .sort((a, b) => wert(a) - wert(b));

                while (ueberzaehlig > 0 && ueberhang.length > 0) {
                    const weg = ueberhang.shift();
                    const regel = this.gruppeZu(weg.pos);
                    const schluessel = regel ? regel.ersatz : null;
                    if (schluessel !== null && (gruppe[schluessel] || 0) <= 0) continue;

                    if (schluessel !== null) gruppe[schluessel]--;
                    rest[weg.pos]--;
                    club.playerIds = club.playerIds.filter(id => id !== weg.id);
                    club.lineup = (club.lineup || []).filter(id => id !== weg.id);
                    club.bench = (club.bench || []).filter(id => id !== weg.id);
                    weg.clubId = null;
                    weg.contractYears = 0;
                    ueberzaehlig--;
                }
            }

            const fehlend = anzahl;
            const gewuenscht = wunsch.slice(0, fehlend);
            const grundlage = {
                clubStrength: typeof club.clubStrength === "number" ? club.clubStrength : 0.5,
                countryId: league.countryId || "de"
            };

            // Die Nachwuchsplätze werden mit Talenten besetzt, der Rest mit
            // Spielern aus dem gesamten Altersbogen.
            const jugendPlaetze = Math.min(jugendLuecke, fehlend);
            const nachschub = [];
            if (jugendPlaetze > 0) {
                nachschub.push(...playerGen.generateSquad(club.id, league.level || 1, jugendPlaetze, Object.assign({}, grundlage, {
                    positions: gewuenscht.slice(0, jugendPlaetze),
                    ageRange: [17, 20]
                })));
            }
            if (fehlend > jugendPlaetze) {
                nachschub.push(...playerGen.generateSquad(club.id, league.level || 1, fehlend - jugendPlaetze, Object.assign({}, grundlage, {
                    positions: gewuenscht.slice(jugendPlaetze)
                })));
            }

            nachschub.forEach(player => {
                state.players.push(player);
                club.playerIds.push(player.id);
            });
            erzeugt += nachschub.length;

            if (gameState && typeof gameState.autoSetLineupForClub === "function") {
                gameState.autoSetLineupForClub(club, state.players);
            }
        });

        return erzeugt;
    }

    /**
     * Erzeugt für jede Liga einen eigenen Spielplan.
     * Der Spielplan der Nutzerliga bleibt in state.schedule, alle anderen
     * landen in state.otherSchedules.
     */
    static generateAllSchedules(state, userLeagueId) {
        const leagues = this.getLeagues();
        const gameState = this.getGameState();
        if (!gameState) return;

        state.otherSchedules = {};
        state.standingsByLeague = state.standingsByLeague || {};

        leagues.forEach(league => {
            const clubs = state.clubs.filter(c => c.leagueId === league.id);
            if (clubs.length < 2) return;

            const schedule = gameState.generateSchedule(clubs);
            schedule.forEach(round => round.matches.forEach(m => { m.leagueId = league.id; }));

            if (league.id === userLeagueId) {
                state.schedule = schedule;
                state.totalMatchdays = schedule.length;
            } else {
                state.otherSchedules[league.id] = schedule;
            }

            state.standingsByLeague[league.id] = gameState.calculateStandings(clubs, schedule, 0);
        });
    }

    /** Liefert den Spielplan einer beliebigen Liga */
    static getSchedule(state, leagueId) {
        if (!state) return [];
        const userLeagueId = this.getUserLeagueId(state);
        if (leagueId === userLeagueId) return state.schedule || [];
        return (state.otherSchedules && state.otherSchedules[leagueId]) || [];
    }

    static getUserLeagueId(state) {
        if (!state) return "de_liga_1";
        const club = (state.clubs || []).find(c => c.id === state.userClubId);
        return club?.leagueId || state.userLeagueId || "de_liga_1";
    }
}

if (typeof window !== "undefined") {
    window.WorldGenerator = WorldGenerator;
}

if (typeof module !== "undefined" && module.exports) {
    module.exports = { WorldGenerator };
}
