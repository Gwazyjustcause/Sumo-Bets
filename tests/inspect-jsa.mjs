const headers = {
  "user-agent": "Mozilla/5.0 (compatible; SumoBattleUpdater/2.0; +https://github.com/)",
  "accept-language": "en-US,en;q=0.9",
  referer: "https://www.sumo.or.jp/EnHonbashoMain/",
  "x-requested-with": "XMLHttpRequest",
  "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
};
const response = await fetch("https://www.sumo.or.jp/EnHonbashoMain/hoshitoriAjax/1/1/", {
  method: "POST", headers, body: "kakuzuke_id=1&ew_flg=1",
});
const source = await response.json();
for (const side of ["E", "W"]) {
  for (const person of source.BanzukeTable[side]) {
    if (![3761, 4121].includes(person.rikishi_id)) continue;
    const record = source.TorikumiData[side][person.rikishi_id];
    console.log(person.shikona_eng, JSON.stringify(record, null, 2));
  }
}
