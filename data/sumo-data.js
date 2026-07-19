window.SUMO_DATA = {
  meta: {
    tournament: "Nagoya Basho 2026",
    shortTournament: "Nagoya 2026",
    day: 0,
    totalDays: 15,
    dateRange: "12–26 July 2026",
    venue: "IG Arena, Aichi",
    lastUpdated: "Awaiting the first result",
    status: "Draft not started",
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
      score: 0,
      today: 0,
      color: "violet",
      streak: 0,
      sidePrediction: null,
      favouriteWrestler: "",
      daily: [],
      team: [],
      subs: [],
    },
    {
      id: "jake",
      name: "Jake",
      initials: "JK",
      score: 0,
      today: 0,
      color: "gold",
      streak: 0,
      sidePrediction: null,
      favouriteWrestler: "",
      daily: [],
      team: [],
      subs: [],
    },
  ],
  rikishi: [],
  bouts: [],
  history: [],
};

// The official division list is the source of truth for the Banzuke page. Keep
// tournament membership and rank positions here, rather than in presentation code.
(() => {
  const developmentDiagnostics = window.SUMO_DEBUG === true
    || ["localhost", "127.0.0.1"].includes(window.location?.hostname);
  const officialMakuuchi = [
    { id: "hoshoryu", name: "Hoshoryu", fullName: "Hoshoryu Tomokatsu", rank: "Yokozuna", rankSeat: 1, side: "East", stable: "Tatsunami", birthplace: "Mongolia", rikishiId: 3842, photoFile: "20170096.jpg" },
    { id: "onosato", name: "Onosato", fullName: "Onosato Daiki", rank: "Yokozuna", rankSeat: 1, side: "West", stable: "Nishonoseki", birthplace: "Ishikawa", rikishiId: 4227, photoFile: "20230048.jpg" },
    { id: "kirishima", name: "Kirishima", fullName: "Kirishima Tetsuo", rank: "Ozeki", rankSeat: 1, side: "East", stable: "Otowayama", birthplace: "Mongolia", rikishiId: 3622, photoFile: "20150034.jpg" },
    { id: "kotozakura", name: "Kotozakura", fullName: "Kotozakura Masakatsu", rank: "Ozeki", rankSeat: 1, side: "West", stable: "Sadogatake", birthplace: "Chiba", rikishiId: 3661, photoFile: "20150081.jpg" },
    { id: "atamifuji", name: "Atamifuji", fullName: "Atamifuji Sakutaro", rank: "Sekiwake", rankSeat: 1, side: "East", stable: "Isegahama", birthplace: "Shizuoka", rikishiId: 4055, photoFile: "20200074.jpg" },
    { id: "kotoshoho", name: "Kotoshoho", fullName: "Kotoshoho Yoshinari", rank: "Sekiwake", rankSeat: 1, side: "West", stable: "Sadogatake", birthplace: "Chiba", rikishiId: 3840, photoFile: "20170094.jpg" },
    { id: "wakatakakage", name: "Wakatakakage", fullName: "Wakatakakage Atsushi", rank: "Sekiwake", rankSeat: 2, side: "East", stable: "Arashio", birthplace: "Fukushima", rikishiId: 3761, photoFile: "20170011.jpg" },
    { id: "aonishiki", name: "Aonishiki", fullName: "Aonishiki Arata", rank: "Sekiwake", rankSeat: 2, side: "West", stable: "Ajigawa", birthplace: "Ukraine", rikishiId: 4230, photoFile: "20230052.jpg" },
    { id: "yoshinofuji", name: "Yoshinofuji", fullName: "Yoshinofuji Naoya", rank: "Komusubi", rankSeat: 1, side: "East", stable: "Isegahama", birthplace: "Kumamoto", rikishiId: 4279, photoFile: "20240045.jpg" },
    { id: "oho", name: "Oho", fullName: "Oho Konosuke", rank: "Komusubi", rankSeat: 1, side: "West", stable: "Otake", birthplace: "Tokyo", rikishiId: 3844, photoFile: "20180002.jpg" },
    { id: "fujinokawa", name: "Fujinokawa", fullName: "Fujinokawa Seigo", rank: "Maegashira 1", rankNumber: 1, rankSeat: 1, side: "East", stable: "Isenoumi", birthplace: "Kyoto", rikishiId: 4191, photoFile: "20230008.jpg" },
    { id: "takanosho", name: "Takanosho", fullName: "Takanosho Nobuaki", rank: "Maegashira 1", rankNumber: 1, rankSeat: 1, side: "West", stable: "Minatogawa", birthplace: "Chiba", rikishiId: 3265, photoFile: "20100039.jpg" },
    { id: "gonoyama", name: "Gonoyama", fullName: "Gonoyama Toki", rank: "Maegashira 2", rankNumber: 2, rankSeat: 1, side: "East", stable: "Takekuma", birthplace: "Osaka", rikishiId: 4079, photoFile: "20210023.jpg" },
    { id: "churanoumi", name: "Churanoumi", fullName: "Churanoumi Yoshihisa", rank: "Maegashira 2", rankNumber: 2, rankSeat: 1, side: "West", stable: "Kise", birthplace: "Okinawa", rikishiId: 3711, photoFile: "20160048.jpg" },
    { id: "hiradoumi", name: "Hiradoumi", fullName: "Hiradoumi Yuki", rank: "Maegashira 3", rankNumber: 3, rankSeat: 1, side: "East", stable: "Sakaigawa", birthplace: "Nagasaki", rikishiId: 3705, photoFile: "20160042.jpg" },
    { id: "hakunofuji", name: "Hakunofuji", fullName: "Hakunofuji Tetsuya", rank: "Maegashira 3", rankNumber: 3, rankSeat: 1, side: "West", stable: "Isegahama", birthplace: "Tottori", rikishiId: 4187, photoFile: "20230004.jpg" },
    { id: "daieisho", name: "Daieisho", fullName: "Daieisho Hayato", rank: "Maegashira 4", rankNumber: 4, rankSeat: 1, side: "East", stable: "Oitekaze", birthplace: "Saitama", rikishiId: 3376, photoFile: "20120003.jpg" },
    { id: "ichiyamamoto", name: "Ichiyamamoto", fullName: "Ichiyamamoto Daiki", rank: "Maegashira 4", rankNumber: 4, rankSeat: 1, side: "West", stable: "Hanaregoma", birthplace: "Hokkaido", rikishiId: 3753, photoFile: "20170002.jpg" },
    { id: "ura", name: "Ura", fullName: "Ura Kazuki", rank: "Maegashira 5", rankNumber: 5, rankSeat: 1, side: "East", stable: "Kise", birthplace: "Osaka", rikishiId: 3616, photoFile: "20150028.jpg" },
    { id: "oshoma", name: "Oshoma", fullName: "Oshoma Degi", rank: "Maegashira 5", rankNumber: 5, rankSeat: 1, side: "West", stable: "Naruto", birthplace: "Mongolia", rikishiId: 4108, photoFile: "20210053.jpg" },
    { id: "shodai", name: "Shodai", fullName: "Shodai Naoya", rank: "Maegashira 6", rankNumber: 6, rankSeat: 1, side: "East", stable: "Tokitsukaze", birthplace: "Kumamoto", rikishiId: 3521, photoFile: "20140019.jpg" },
    { id: "fujiseiun", name: "Fujiseiun", fullName: "Fujiseiun Tatsuki", rank: "Maegashira 6", rankNumber: 6, rankSeat: 1, side: "West", stable: "Fujishima", birthplace: "Kumamoto", rikishiId: 4093, photoFile: "20210037.jpg" },
    { id: "kotoeiho", name: "Kotoeiho", fullName: "Kotoeiho Hiroki", rank: "Maegashira 7", rankNumber: 7, rankSeat: 1, side: "East", stable: "Sadogatake", birthplace: "Chiba", rikishiId: 4120, photoFile: "20220003.jpg" },
    { id: "takayasu", name: "Takayasu", fullName: "Takayasu Akira", rank: "Maegashira 7", rankNumber: 7, rankSeat: 1, side: "West", stable: "Tagonoura", birthplace: "Ibaraki", rikishiId: 2775, photoFile: "20050022.jpg" },
    { id: "wakamotoharu", name: "Wakamotoharu", fullName: "Wakamotoharu Minato", rank: "Maegashira 8", rankNumber: 8, rankSeat: 1, side: "East", stable: "Arashio", birthplace: "Fukushima", rikishiId: 3371, photoFile: "20110065.jpg" },
    { id: "roga", name: "Roga", fullName: "Roga Tokiyoshi", rank: "Maegashira 8", rankNumber: 8, rankSeat: 1, side: "West", stable: "Futagoyama", birthplace: "Russia", rikishiId: 3907, photoFile: "20180068.jpg" },
    { id: "fujiryoga", name: "Fujiryoga", fullName: "Fujiryoga Masaharu", rank: "Maegashira 9", rankNumber: 9, rankSeat: 1, side: "East", stable: "Fujishima", birthplace: "Aichi", rikishiId: 4336, photoFile: "20250038.jpg" },
    { id: "tobizaru", name: "Tobizaru", fullName: "Tobizaru Masaya", rank: "Maegashira 9", rankNumber: 9, rankSeat: 1, side: "West", stable: "Oitekaze", birthplace: "Tokyo", rikishiId: 3594, photoFile: "20150005.jpg" },
    { id: "asanoyama", name: "Asanoyama", fullName: "Asanoyama Hiroki", rank: "Maegashira 10", rankNumber: 10, rankSeat: 1, side: "East", stable: "Takasago", birthplace: "Toyama", rikishiId: 3682, photoFile: "20160019.jpg" },
    { id: "chiyoshoma", name: "Chiyoshoma", fullName: "Chiyoshoma Fujio", rank: "Maegashira 10", rankNumber: 10, rankSeat: 1, side: "West", stable: "Kokonoe", birthplace: "Mongolia", rikishiId: 3207, photoFile: "20090066.jpg" },
    { id: "wakanosho", name: "Wakanosho", fullName: "Wakanosho Eido", rank: "Maegashira 11", rankNumber: 11, rankSeat: 1, side: "East", stable: "Minatogawa", birthplace: "Tochigi", rikishiId: 4121, photoFile: "20220004.jpg" },
    { id: "mitakeumi", name: "Mitakeumi", fullName: "Mitakeumi Hisashi", rank: "Maegashira 11", rankNumber: 11, rankSeat: 1, side: "West", stable: "Dewanoumi", birthplace: "Nagano", rikishiId: 3620, photoFile: "20150032.jpg" },
    { id: "asahakuryu", name: "Asahakuryu", fullName: "Asahakuryu Taro", rank: "Maegashira 12", rankNumber: 12, rankSeat: 1, side: "East", stable: "Takasago", birthplace: "Mongolia", rikishiId: 4175, photoFile: "20220063.jpg" },
    { id: "abi", name: "Abi", fullName: "Abi Masatora", rank: "Maegashira 12", rankNumber: 12, rankSeat: 1, side: "West", stable: "Shikoroyama", birthplace: "Saitama", rikishiId: 3485, photoFile: "20130059.jpg" },
    { id: "nishikifuji", name: "Nishikifuji", fullName: "Nishikifuji Ryusei", rank: "Maegashira 13", rankNumber: 13, rankSeat: 1, side: "East", stable: "Isegahama", birthplace: "Aomori", rikishiId: 3742, photoFile: "20160081.jpg" },
    { id: "takerufuji", name: "Takerufuji", fullName: "Takerufuji Mikiya", rank: "Maegashira 13", rankNumber: 13, rankSeat: 1, side: "West", stable: "Isegahama", birthplace: "Aomori", rikishiId: 4171, photoFile: "20220059.jpg" },
    { id: "kinbozan", name: "Kinbozan", fullName: "Kinbozan Haruki", rank: "Maegashira 14", rankNumber: 14, rankSeat: 1, side: "East", stable: "Kise", birthplace: "Kazakhstan", rikishiId: 4112, photoFile: "20210057.jpg" },
    { id: "shishi", name: "Shishi", fullName: "Shishi Masaru", rank: "Maegashira 14", rankNumber: 14, rankSeat: 1, side: "West", stable: "Ikazuchi", birthplace: "Ukraine", rikishiId: 3990, photoFile: "20200005.jpg" },
    { id: "onokatsu", name: "Onokatsu", fullName: "Onokatsu Kazuhiro", rank: "Maegashira 15", rankNumber: 15, rankSeat: 1, side: "East", stable: "Onomatsu", birthplace: "Mongolia", rikishiId: 4231, photoFile: "20230053.jpg" },
    { id: "kazuma", name: "Kazuma", fullName: "Kazuma Torakaze", rank: "Maegashira 15", rankNumber: 15, rankSeat: 1, side: "West", stable: "Kise", birthplace: "Osaka", rikishiId: 4287, photoFile: "20240054.jpg" },
    { id: "daiseizan", name: "Daiseizan", fullName: "Daiseizan Daisuke", rank: "Maegashira 16", rankNumber: 16, rankSeat: 1, side: "East", stable: "Arashio", birthplace: "China", rikishiId: 4116, photoFile: "20210061.jpg" },
    { id: "asakoryu", name: "Asakoryu", fullName: "Asakoryu Takuma", rank: "Maegashira 16", rankNumber: 16, rankSeat: 1, side: "West", stable: "Takasago", birthplace: "Osaka", rikishiId: 4101, photoFile: "20210046.jpg" },
  ];

  // Explicitly keyed lookup terms avoid deriving external identities from a
  // display name. They can be corrected independently if a page is renamed.
  const wikipediaById = Object.freeze({
    hoshoryu: "Hōshōryū Tomokatsu", onosato: "Ōnosato Daiki", kirishima: "Kirishima Tetsuo", kotozakura: "Kotozakura Masakatsu",
    atamifuji: "Atamifuji Sakutarō", kotoshoho: "Kotoshōhō Yoshinari", wakatakakage: "Wakatakakage Atsushi", aonishiki: "Aonishiki Arata",
    yoshinofuji: "Yoshinofuji Naoya", oho: "Ōhō Kōnosuke", fujinokawa: "Fujinokawa Seigo", takanosho: "Takanoshō Nobuaki",
    gonoyama: "Gōnoyama Tōki", churanoumi: "Churanoumi Yoshihisa", hiradoumi: "Hiradoumi Yūki", hakunofuji: "Hakunofuji Tetsuya",
    daieisho: "Daieishō Hayato", ichiyamamoto: "Ichiyamamoto Daiki", ura: "Ura Kazuki", oshoma: "Ōshōma Degi",
    shodai: "Shōdai Naoya", fujiseiun: "Fujiseiun Tatsuki", kotoeiho: "Kotoeihō Hiroki", takayasu: "Takayasu Akira",
    wakamotoharu: "Wakamotoharu Minato", roga: "Rōga Tokiyoshi", fujiryoga: "Fujiryōga Masaharu", tobizaru: "Tobizaru Masaya",
    asanoyama: "Asanoyama Hiroki", chiyoshoma: "Chiyoshōma Fujio", wakanosho: "Wakanoshō Eidō", mitakeumi: "Mitakeumi Hisashi",
    asahakuryu: "Asahakuryū Tarō", abi: "Abi Masatora", nishikifuji: "Nishikifuji Ryūsei", takerufuji: "Takerufuji Mikiya",
    kinbozan: "Kinbōzan Haruki", shishi: "Shishi Masaru", onokatsu: "Ōnokatsu Kazuhiro", kazuma: "Kazuma Torakaze",
    daiseizan: "Daiseizan Daisuke", asakoryu: "Asakōryū Takuma",
  });

  // Parsing is deliberately a one-to-one map. No rank, side, image, profile,
  // or metadata condition is allowed to remove a source wrestler.
  const parsedMakuuchi = officialMakuuchi.map((source, sourceIndex) => {
    const parsed = {
      ...source,
      sourceIndex,
      shikona: source.name,
      record: "0–0",
      wins: 0,
      losses: 0,
      absences: 0,
      available: true,
    };
    if (developmentDiagnostics) {
      console.info([
        `Rank: ${parsed.rank || "Unknown rank"}`,
        `Side: ${parsed.side || "Unknown side"}`,
        `Name: ${parsed.shikona || parsed.id || "Unknown rikishi"}`,
        "Status: Parsed ✓",
      ].join("\n"));
    }
    return parsed;
  });

  const existingById = new Map(window.SUMO_DATA.rikishi.map((rikishi) => [rikishi.id, rikishi]));
  window.SUMO_DATA.rikishi = parsedMakuuchi.map((official) => {
    const existing = existingById.get(official.id) || {};
    const jsaPortrait = `https://www.sumo.or.jp/img/sumo_data/rikishi/270x474/${official.photoFile}`;
    return {
      height: "—",
      weight: "—",
      careerHigh: official.rank,
      technique: "See official profile",
      points: 0,
      ...existing,
      ...official,
      shikona: official.name,
      jsaId: String(official.rikishiId),
      wikipedia: wikipediaById[official.id] || null,
      image: null,
      absences: 0,
      available: true,
      form: 0,
      badge: null,
      profile: `https://www.sumo.or.jp/EnSumoDataRikishi/profile/${official.rikishiId}/`,
      jsaPortrait,
      photo: jsaPortrait,
    };
  });

  window.SUMO_DATA.banzuke = {
    currentBashoId: "nagoya-2026",
    bashos: [{
      id: "nagoya-2026",
      label: "Nagoya 2026",
      tournament: "July Grand Sumo Tournament",
      japaneseTitle: "令和八年 七月場所",
      division: "Makuuchi",
      expectedRikishi: officialMakuuchi.length,
      officialUrl: "https://www.sumo.or.jp/EnHonbashoBanzuke/index/",
      officialRikishi: officialMakuuchi.map(({ id, name: shikona, rank, rankNumber = null, rankSeat = 1, side }, sourceIndex) => ({
        id, shikona, rank, rankNumber, rankSeat, side, sourceIndex,
      })),
      entries: parsedMakuuchi.map(({ id: rikishiId, shikona, rank, rankNumber = null, rankSeat = 1, side, sourceIndex }) => ({
        rikishiId, shikona, rank, rankNumber, rankSeat, side, sourceIndex,
      })),
    }],
  };

  const datasetCounts = window.SUMO_DATA.rikishi.reduce((counts, rikishi) => {
    counts.set(rikishi.id, (counts.get(rikishi.id) || 0) + 1);
    return counts;
  }, new Map());
  officialMakuuchi.forEach((source) => {
    const count = datasetCounts.get(source.id) || 0;
    if (count === 1) return;
    console.error(count === 0
      ? `WARNING\n\n${source.name}\n\nNot parsed`
      : `WARNING\n\n${source.name}\n\nParsed ${count} times; expected exactly once.`);
  });
})();
