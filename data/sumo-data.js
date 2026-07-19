window.SUMO_DATA = {
  meta: {
    tournament: "Nagoya Basho 2026",
    shortTournament: "Nagoya 2026",
    day: 8,
    totalDays: 15,
    dateRange: "12–26 July 2026",
    venue: "IG Arena, Aichi",
    lastUpdated: "19 July 2026 · 17:42 WEST",
    status: "Day 8 bouts complete",
    sources: [
      { label: "Official July banzuke", url: "https://sumo.or.jp/EnHonbashoBanzuke/index/" },
      { label: "Official matches & results", url: "https://sumo.or.jp/EnHonbashoMain/torikumi/1/1/" },
      { label: "Official rikishi profiles", url: "https://sumo.or.jp/EnSumoDataRikishi/search/" },
    ],
  },
  scoring: [
    { label: "Win (kachi)", value: "1 pt" },
    { label: "Make-koshi", value: "−1 pt" },
    { label: "Kinboshi", value: "3 pts" },
    { label: "Correct side", value: "20 pts" },
  ],
  players: [
    {
      id: "gwazy",
      name: "Gwazy",
      initials: "GW",
      score: 284,
      today: 39,
      projection: 82,
      color: "violet",
      streak: 3,
      sidePrediction: "East",
      favouriteWrestler: "aonishiki",
      daily: [0, 34, 67, 101, 137, 184, 238, 284],
      team: ["onosato", "aonishiki", "takayasu", "takerufuji", "gonoyama", "shodai"],
      subs: ["atamifuji", "ura", "abi"],
    },
    {
      id: "jake",
      name: "Jake",
      initials: "JK",
      score: 273,
      today: 34,
      projection: 18,
      color: "gold",
      streak: 0,
      sidePrediction: "West",
      favouriteWrestler: "hoshoryu",
      daily: [0, 37, 69, 106, 150, 179, 239, 273],
      team: ["hoshoryu", "kirishima", "kotoeiho", "nishikifuji", "tobizaru", "hakunofuji"],
      subs: ["kotozakura", "daieisho", "shishi"],
    },
  ],
  rikishi: [
    {
      id: "hoshoryu", name: "Hoshoryu", fullName: "Hoshoryu Tomokatsu", rank: "Yokozuna", side: "East", record: "4–3", wins: 4, losses: 3, points: 32, form: 62,
      stable: "Tatsunami", birthplace: "Mongolia", height: "188 cm", weight: "150 kg", careerHigh: "Yokozuna", technique: "Migi-yotsu · nage", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/3842/", photo: "https://sumo.or.jp/img/sumo_data/rikishi/270x474/20170096.jpg"
    },
    {
      id: "onosato", name: "Onosato", fullName: "Onosato Daiki", rank: "Yokozuna", side: "West", record: "4–3", wins: 4, losses: 3, points: 36, form: 72,
      stable: "Nishonoseki", birthplace: "Ishikawa", height: "192 cm", weight: "189 kg", careerHigh: "Yokozuna", technique: "Tsuki · oshi · yori", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/4227/", photo: "https://sumo.or.jp/img/sumo_data/rikishi/270x474/20230048.jpg"
    },
    {
      id: "kirishima", name: "Kirishima", rank: "Ozeki", side: "East", record: "7–1", wins: 7, losses: 1, points: 48, form: 94,
      stable: "Otowayama", birthplace: "Mongolia", height: "186 cm", weight: "143 kg", careerHigh: "Ozeki", technique: "Migi-yotsu · yori", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/3622/"
    },
    {
      id: "kotozakura", name: "Kotozakura", rank: "Ozeki", side: "West", record: "3–5", wins: 3, losses: 5, points: 24, form: 43,
      stable: "Sadogatake", birthplace: "Chiba", height: "189 cm", weight: "180 kg", careerHigh: "Ozeki", technique: "Migi-yotsu · yori", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/3785/"
    },
    {
      id: "atamifuji", name: "Atamifuji", rank: "Sekiwake", side: "East", record: "5–3", wins: 5, losses: 3, points: 41, form: 78,
      stable: "Isegahama", birthplace: "Shizuoka", height: "187 cm", weight: "197 kg", careerHigh: "Sekiwake", technique: "Migi-yotsu · yori", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/4055/", photo: "https://www.sumo.or.jp/img/sumo_data/rikishi/270x474/20200074.jpg"
    },
    {
      id: "aonishiki", name: "Aonishiki", rank: "Sekiwake", side: "West", record: "7–1", wins: 7, losses: 1, points: 52, form: 98, badge: "CLUTCH PICK",
      stable: "Ajigawa", birthplace: "Ukraine", height: "182 cm", weight: "142 kg", careerHigh: "Ozeki", technique: "Migi-yotsu · yori", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/4230/", photo: "https://sumo.or.jp/img/sumo_data/rikishi/270x474/20230052.jpg"
    },
    {
      id: "wakatakakage", name: "Wakatakakage", rank: "Sekiwake", side: "East", record: "4–4", wins: 4, losses: 4, points: 27, form: 55,
      stable: "Arashio", birthplace: "Fukushima", height: "182 cm", weight: "129 kg", careerHigh: "Sekiwake", technique: "Oshi · hidari-yotsu", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/3761/"
    },
    {
      id: "oho", name: "Oho", rank: "Komusubi", side: "West", record: "2–6", wins: 2, losses: 6, points: 14, form: 31,
      stable: "Otake", birthplace: "Tokyo", height: "191 cm", weight: "178 kg", careerHigh: "Sekiwake", technique: "Migi-yotsu · yori", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/3844/"
    },
    {
      id: "gonoyama", name: "Gonoyama", rank: "Maegashira 2", side: "East", record: "5–3", wins: 5, losses: 3, points: 34, form: 74,
      stable: "Takekuma", birthplace: "Osaka", height: "178 cm", weight: "176 kg", careerHigh: "Komusubi", technique: "Oshi · tsuki", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/4018/"
    },
    {
      id: "hakunofuji", name: "Hakunofuji", rank: "Maegashira 3", side: "West", record: "4–4", wins: 4, losses: 4, points: 28, form: 57,
      stable: "Isegahama", birthplace: "Tottori", height: "181 cm", weight: "160 kg", careerHigh: "Maegashira 2", technique: "Migi-yotsu · yori", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/4187/"
    },
    {
      id: "daieisho", name: "Daieisho", rank: "Maegashira 4", side: "East", record: "3–5", wins: 3, losses: 5, points: 20, form: 41,
      stable: "Oitekaze", birthplace: "Saitama", height: "182 cm", weight: "164 kg", careerHigh: "Sekiwake", technique: "Tsuki · oshi", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/3483/"
    },
    {
      id: "ura", name: "Ura", rank: "Maegashira 5", side: "East", record: "2–6", wins: 2, losses: 6, points: 12, form: 26,
      stable: "Kise", birthplace: "Osaka", height: "176 cm", weight: "139 kg", careerHigh: "Komusubi", technique: "Oshi · ashitori", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/3616/", photo: "https://www.sumo.or.jp/img/sumo_data/rikishi/270x474/20150028.jpg"
    },
    {
      id: "shodai", name: "Shodai", rank: "Maegashira 6", side: "East", record: "4–4", wins: 4, losses: 4, points: 25, form: 52,
      stable: "Tokitsukaze", birthplace: "Kumamoto", height: "184 cm", weight: "165 kg", careerHigh: "Ozeki", technique: "Migi-yotsu · yori", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/3501/"
    },
    {
      id: "kotoeiho", name: "Kotoeiho", rank: "Maegashira 7", side: "East", record: "7–1", wins: 7, losses: 1, points: 45, form: 91, badge: "CLUTCH PICK",
      stable: "Sadogatake", birthplace: "Chiba", height: "178 cm", weight: "155 kg", careerHigh: "Maegashira 7", technique: "Oshi · yori", profile: "https://sumo.or.jp/EnSumoDataRikishi/search/"
    },
    {
      id: "takayasu", name: "Takayasu", rank: "Maegashira 7", side: "West", record: "6–2", wins: 6, losses: 2, points: 43, form: 87,
      stable: "Tagonoura", birthplace: "Ibaraki", height: "187 cm", weight: "182 kg", careerHigh: "Ozeki", technique: "Tsuki · oshi", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/3263/"
    },
    {
      id: "tobizaru", name: "Tobizaru", rank: "Maegashira 9", side: "West", record: "3–5", wins: 3, losses: 5, points: 18, form: 39,
      stable: "Oitekaze", birthplace: "Tokyo", height: "175 cm", weight: "135 kg", careerHigh: "Komusubi", technique: "Oshi · nage", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/3640/"
    },
    {
      id: "abi", name: "Abi", rank: "Maegashira 12", side: "West", record: "4–4", wins: 4, losses: 4, points: 29, form: 59,
      stable: "Shikoroyama", birthplace: "Saitama", height: "187 cm", weight: "166 kg", careerHigh: "Sekiwake", technique: "Tsuki · oshi", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/3485/"
    },
    {
      id: "nishikifuji", name: "Nishikifuji", rank: "Maegashira 13", side: "East", record: "6–2", wins: 6, losses: 2, points: 46, form: 89,
      stable: "Isegahama", birthplace: "Aomori", height: "184 cm", weight: "151 kg", careerHigh: "Maegashira 3", technique: "Oshi · yori", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/3745/"
    },
    {
      id: "takerufuji", name: "Takerufuji", rank: "Maegashira 13", side: "West", record: "6–2", wins: 6, losses: 2, points: 50, form: 93,
      stable: "Isegahama", birthplace: "Aomori", height: "184 cm", weight: "143 kg", careerHigh: "Maegashira 4", technique: "Oshi · tsuki", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/4171/"
    },
    {
      id: "shishi", name: "Shishi", rank: "Maegashira 14", side: "West", record: "6–2", wins: 6, losses: 2, points: 44, form: 86,
      stable: "Ikazuchi", birthplace: "Ukraine", height: "193 cm", weight: "172 kg", careerHigh: "Maegashira 6", technique: "Migi-yotsu · yori", profile: "https://sumo.or.jp/EnSumoDataRikishi/profile/4022/"
    },
    {
      id: "onokatsu", name: "Onokatsu", rank: "Maegashira 15", side: "East", record: "4–4", wins: 4, losses: 4, points: 26, form: 54,
      stable: "Onomatsu", birthplace: "Mongolia", height: "186 cm", weight: "164 kg", careerHigh: "Maegashira 9", technique: "Migi-yotsu · yori", profile: "https://sumo.or.jp/EnSumoDataRikishi/search/"
    },
  ],
  bouts: [
    { east: "ura", west: "takayasu", importance: 5, winner: "ura", technique: "oshidashi", time: "6.2s", swing: "+8 Gwazy" },
    { east: "atamifuji", west: "kirishima", importance: 5, winner: "kirishima", technique: "yorikiri", time: "9.8s", swing: "+6 Jake" },
    { east: "kotoeiho", west: "tobizaru", importance: 3, winner: "kotoeiho", technique: "hatakikomi", time: "3.7s", swing: "+5 Jake" },
    { east: "nishikifuji", west: "takerufuji", importance: 5, winner: "takerufuji", technique: "tsukiotoshi", time: "4.1s", swing: "+7 Gwazy" },
    { east: "hoshoryu", west: "daieisho", importance: 4, winner: "hoshoryu", technique: "uwatenage", time: "11.4s", swing: "+4 Jake" },
    { east: "aonishiki", west: "kotozakura", importance: 5, winner: "aonishiki", technique: "yorikiri", time: "8.6s", swing: "+9 Gwazy" },
    { east: "gonoyama", west: "hakunofuji", importance: 2, winner: "gonoyama", technique: "oshidashi", time: "5.9s", swing: "+3 Gwazy" },
    { east: "onokatsu", west: "abi", importance: 2, winner: "abi", technique: "tsukidashi", time: "4.8s", swing: "+2 Gwazy" },
    { east: "onosato", west: "oho", importance: 4, winner: "onosato", technique: "yorikiri", time: "7.3s", swing: "+4 Gwazy" },
  ],
  history: [
    {
      id: "natsu-2026", basho: "Natsu 2026", winner: "Gwazy", gwazyScore: 467, jakeScore: 441, comeback: 18, badge: "COMEBACK", mvp: "aonishiki",
      rosters: {
        gwazy: ["onosato", "aonishiki", "takayasu", "takerufuji", "gonoyama", "shodai", "atamifuji", "ura", "abi"],
        jake: ["hoshoryu", "kirishima", "kotoeiho", "nishikifuji", "tobizaru", "hakunofuji", "kotozakura", "daieisho", "shishi"],
      },
      predictions: { gwazy: "East", jake: "West" }, bonusPoints: { gwazy: 20, jake: 0 },
      notes: { gwazy: "Aonishiki turned the basho on Day 11.", jake: "The late push came one day too late." },
      bestPicks: { gwazy: "aonishiki", jake: "kirishima" }, worstPicks: { gwazy: "ura", jake: "tobizaru" },
    },
    {
      id: "haru-2026", basho: "Haru 2026", winner: "Jake", gwazyScore: 449, jakeScore: 452, comeback: 7, badge: "PHOTO FINISH", mvp: "kirishima",
      rosters: {
        gwazy: ["onosato", "atamifuji", "takayasu", "ura", "gonoyama", "shodai", "aonishiki", "abi", "takerufuji"],
        jake: ["hoshoryu", "kirishima", "kotozakura", "kotoeiho", "hakunofuji", "tobizaru", "daieisho", "nishikifuji", "shishi"],
      },
      predictions: { gwazy: "West", jake: "East" }, bonusPoints: { gwazy: 0, jake: 20 },
      notes: { gwazy: "Lost the lead on the final bout.", jake: "Three points. Never in doubt." },
      bestPicks: { gwazy: "onosato", jake: "kirishima" }, worstPicks: { gwazy: "shodai", jake: "tobizaru" },
    },
    {
      id: "hatsu-2026", basho: "Hatsu 2026", winner: "Gwazy", gwazyScore: 481, jakeScore: 438, comeback: 4, badge: "PERFECT EAST", mvp: "onosato",
      rosters: {
        gwazy: ["onosato", "aonishiki", "takayasu", "takerufuji", "gonoyama", "ura", "atamifuji", "abi", "shodai"],
        jake: ["hoshoryu", "kirishima", "kotozakura", "kotoeiho", "nishikifuji", "hakunofuji", "daieisho", "tobizaru", "shishi"],
      },
      predictions: { gwazy: "East", jake: "West" }, bonusPoints: { gwazy: 20, jake: 0 },
      notes: { gwazy: "Perfect East call and a clean win.", jake: "Never recovered from Day 4." },
      bestPicks: { gwazy: "onosato", jake: "hoshoryu" }, worstPicks: { gwazy: "ura", jake: "kotozakura" },
    },
    {
      id: "kyushu-2025", basho: "Kyushu 2025", winner: "Gwazy", gwazyScore: 459, jakeScore: 451, comeback: 15, badge: "SUB SAVER", mvp: "ura",
      rosters: {
        gwazy: ["onosato", "aonishiki", "takayasu", "gonoyama", "shodai", "nishikifuji", "ura", "abi", "takerufuji"],
        jake: ["hoshoryu", "kirishima", "kotozakura", "kotoeiho", "hakunofuji", "tobizaru", "daieisho", "atamifuji", "shishi"],
      },
      predictions: { gwazy: "West", jake: "West" }, bonusPoints: { gwazy: 20, jake: 20 },
      notes: { gwazy: "Ura's substitute points saved it.", jake: "Eight points short." },
      bestPicks: { gwazy: "ura", jake: "hoshoryu" }, worstPicks: { gwazy: "shodai", jake: "tobizaru" },
    },
    {
      id: "aki-2025", basho: "Aki 2025", winner: "Jake", gwazyScore: 433, jakeScore: 472, comeback: 6, badge: "KING OF EAST", mvp: "onosato",
      rosters: {
        gwazy: ["aonishiki", "atamifuji", "takayasu", "ura", "gonoyama", "shodai", "takerufuji", "abi", "nishikifuji"],
        jake: ["onosato", "hoshoryu", "kirishima", "kotoeiho", "hakunofuji", "tobizaru", "kotozakura", "daieisho", "shishi"],
      },
      predictions: { gwazy: "West", jake: "East" }, bonusPoints: { gwazy: 0, jake: 20 },
      notes: { gwazy: "Wrong side and the wrong captain.", jake: "Onosato carried everything." },
      bestPicks: { gwazy: "takayasu", jake: "onosato" }, worstPicks: { gwazy: "ura", jake: "tobizaru" },
    },
    {
      id: "nagoya-2025", basho: "Nagoya 2025", winner: "Gwazy", gwazyScore: 446, jakeScore: 440, comeback: 11, badge: "UNDERDOG", mvp: "takerufuji",
      rosters: {
        gwazy: ["onosato", "aonishiki", "takayasu", "takerufuji", "gonoyama", "shodai", "atamifuji", "ura", "abi"],
        jake: ["hoshoryu", "kirishima", "kotozakura", "kotoeiho", "nishikifuji", "hakunofuji", "daieisho", "tobizaru", "shishi"],
      },
      predictions: { gwazy: "East", jake: "West" }, bonusPoints: { gwazy: 20, jake: 0 },
      notes: { gwazy: "The underdog rule finally paid off.", jake: "Six points is brutal." },
      bestPicks: { gwazy: "takerufuji", jake: "kirishima" }, worstPicks: { gwazy: "ura", jake: "tobizaru" },
    },
  ],
};
