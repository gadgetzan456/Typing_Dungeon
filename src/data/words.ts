// 単語データ。種類ごとに [表示テキスト, 読み（ひらがな）, テーマ] で並べる。
// 文字数は読みの長さで数える。

export type WordKind = 'word' | 'katakana' | 'idiom' | 'proverb' | 'sentence';
export type WordTheme = 'battle' | 'magic' | 'monster' | 'nature' | 'adventure' | 'daily' | 'game';

export const KIND_LABEL: Record<WordKind, string> = {
  word: '単語',
  katakana: 'カタカナ語',
  idiom: '四字熟語',
  proverb: 'ことわざ',
  sentence: '文章',
};

export const THEME_LABEL: Record<WordTheme, string> = {
  battle: '戦い',
  magic: '魔法',
  monster: '魔物',
  nature: '自然',
  adventure: '冒険',
  daily: '日常',
  game: 'ゲーム',
};

export const WORD_KINDS = Object.keys(KIND_LABEL) as WordKind[];

type Entry = [display: string, reading: string, theme: WordTheme];

const RAW: Record<WordKind, Entry[]> = {
  word: [
    ['桜', 'さくら', 'nature'], ['卵', 'たまご', 'daily'], ['蜜柑', 'みかん', 'daily'], ['林檎', 'りんご', 'daily'],
    ['眼鏡', 'めがね', 'daily'], ['机', 'つくえ', 'daily'], ['鏡', 'かがみ', 'daily'], ['魔法', 'まほう', 'magic'],
    ['炎', 'ほのお', 'nature'], ['氷', 'こおり', 'nature'], ['刀', 'かたな', 'battle'], ['弓矢', 'ゆみや', 'battle'],
    ['扉', 'とびら', 'adventure'], ['竜', 'りゅう', 'monster'], ['魔王', 'まおう', 'monster'], ['お城', 'おしろ', 'adventure'],
    ['砂漠', 'さばく', 'nature'], ['火山', 'かざん', 'nature'], ['戦士', 'せんし', 'battle'], ['金貨', 'きんか', 'adventure'],
    ['銀貨', 'ぎんか', 'adventure'], ['酒場', 'さかば', 'adventure'], ['宿屋', 'やどや', 'adventure'], ['武器屋', 'ぶきや', 'adventure'],
    ['防具', 'ぼうぐ', 'battle'], ['秘宝', 'ひほう', 'adventure'], ['牢屋', 'ろうや', 'adventure'], ['鎖', 'くさり', 'battle'],
    ['鎧', 'よろい', 'battle'], ['兜', 'かぶと', 'battle'], ['指輪', 'ゆびわ', 'adventure'], ['光', 'ひかり', 'nature'],
    ['嵐', 'あらし', 'nature'], ['地震', 'じしん', 'nature'], ['津波', 'つなみ', 'nature'], ['銀河', 'ぎんが', 'nature'],
    ['勇者', 'ゆうしゃ', 'adventure'], ['洞窟', 'どうくつ', 'adventure'], ['雷', 'かみなり', 'nature'], ['星空', 'ほしぞら', 'nature'],
    ['薬草', 'やくそう', 'adventure'], ['階段', 'かいだん', 'adventure'], ['骸骨', 'がいこつ', 'monster'], ['幽霊', 'ゆうれい', 'monster'],
    ['王様', 'おうさま', 'adventure'], ['雪山', 'ゆきやま', 'nature'], ['草原', 'そうげん', 'nature'], ['冒険', 'ぼうけん', 'adventure'],
    ['僧侶', 'そうりょ', 'adventure'], ['盗賊', 'とうぞく', 'adventure'], ['回復', 'かいふく', 'magic'], ['呪文', 'じゅもん', 'magic'],
    ['結界', 'けっかい', 'magic'], ['封印', 'ふういん', 'magic'], ['伝説', 'でんせつ', 'adventure'], ['財宝', 'ざいほう', 'adventure'],
    ['松明', 'たいまつ', 'adventure'], ['地下室', 'ちかしつ', 'adventure'], ['巻物', 'まきもの', 'magic'], ['番人', 'ばんにん', 'battle'],
    ['雷鳴', 'らいめい', 'nature'], ['暗闇', 'くらやみ', 'nature'], ['稲妻', 'いなずま', 'nature'], ['竜巻', 'たつまき', 'nature'],
    ['隕石', 'いんせき', 'nature'], ['太陽', 'たいよう', 'nature'], ['満月', 'まんげつ', 'nature'], ['三日月', 'みかづき', 'nature'],
    ['宇宙', 'うちゅう', 'nature'], ['惑星', 'わくせい', 'nature'], ['宝箱', 'たからばこ', 'adventure'], ['迷宮', 'めいきゅう', 'adventure'],
    ['召喚', 'しょうかん', 'magic'], ['落とし穴', 'おとしあな', 'adventure'], ['首飾り', 'くびかざり', 'adventure'], ['水晶', 'すいしょう', 'magic'],
    ['魔法陣', 'まほうじん', 'magic'], ['守護者', 'しゅごしゃ', 'battle'], ['不死鳥', 'ふしちょう', 'monster'], ['影法師', 'かげぼうし', 'monster'],
    ['流星', 'りゅうせい', 'nature'], ['経験値', 'けいけんち', 'adventure'], ['大魔王', 'だいまおう', 'monster'], ['宝物庫', 'ほうもつこ', 'adventure'],
    ['闇の騎士', 'やみのきし', 'monster'], ['竜の巣', 'りゅうのす', 'monster'], ['光の矢', 'ひかりのや', 'magic'], ['魔法使い', 'まほうつかい', 'magic'],
    ['吸血鬼', 'きゅうけつき', 'monster'], ['冒険者', 'ぼうけんしゃ', 'adventure'], ['古代遺跡', 'こだいいせき', 'adventure'], ['魔法の杖', 'まほうのつえ', 'magic'],
    ['秘密の部屋', 'ひみつのへや', 'adventure'], ['星降る夜', 'ほしふるよる', 'nature'], ['古びた地図', 'ふるびたちず', 'adventure'], ['迷いの森', 'まよいのもり', 'nature'],
    ['眠れる獅子', 'ねむれるしし', 'monster'], ['宝探し', 'たからさがし', 'adventure'], ['狼男', 'おおかみおとこ', 'monster'], ['地下迷宮', 'ちかめいきゅう', 'adventure'],
    ['伝説の剣', 'でんせつのけん', 'battle'], ['最後の扉', 'さいごのとびら', 'adventure'], ['黄金の鍵', 'おうごんのかぎ', 'adventure'], ['回復の泉', 'かいふくのいずみ', 'magic'],
    ['炎の精霊', 'ほのおのせいれい', 'magic'], ['氷の女王', 'こおりのじょおう', 'monster'], ['呪われた鎧', 'のろわれたよろい', 'battle'], ['嵐の前触れ', 'あらしのまえぶれ', 'nature'],
    ['勇者の証', 'ゆうしゃのあかし', 'adventure'], ['会心の一撃', 'かいしんのいちげき', 'battle'], ['勝利の雄叫び', 'しょうりのおたけび', 'battle'],
  ],
  katakana: [
    ['コンボ', 'こんぼ', 'game'], ['ドラゴン', 'どらごん', 'monster'], ['スライム', 'すらいむ', 'monster'], ['ゴブリン', 'ごぶりん', 'monster'],
    ['ミミック', 'みみっく', 'monster'], ['ゴーレム', 'ごーれむ', 'monster'], ['ラスボス', 'らすぼす', 'game'], ['ポーション', 'ぽーしょん', 'adventure'],
    ['エリクサー', 'えりくさー', 'adventure'], ['ダンジョン', 'だんじょん', 'adventure'], ['モンスター', 'もんすたー', 'monster'], ['キーボード', 'きーぼーど', 'daily'],
    ['タイピング', 'たいぴんぐ', 'daily'], ['クリティカル', 'くりてぃかる', 'game'], ['フェニックス', 'ふぇにっくす', 'monster'], ['ヴァンパイア', 'ゔぁんぱいあ', 'monster'],
    ['ローグライク', 'ろーぐらいく', 'game'], ['レベルアップ', 'れべるあっぷ', 'game'], ['ファイアボール', 'ふぁいあぼーる', 'magic'], ['サンダーボルト', 'さんだーぼると', 'magic'],
    ['ゲームオーバー', 'げーむおーばー', 'game'], ['コンティニュー', 'こんてぃにゅー', 'game'], ['ティラノサウルス', 'てぃらのさうるす', 'monster'],
  ],
  idiom: [
    ['天下無双', 'てんかむそう', 'battle'], ['起死回生', 'きしかいせい', 'battle'], ['一期一会', 'いちごいちえ', 'daily'], ['試行錯誤', 'しこうさくご', 'daily'],
    ['一騎当千', 'いっきとうせん', 'battle'], ['電光石火', 'でんこうせっか', 'nature'], ['臨機応変', 'りんきおうへん', 'daily'], ['以心伝心', 'いしんでんしん', 'daily'],
    ['七転八起', 'しちてんはっき', 'daily'], ['風林火山', 'ふうりんかざん', 'nature'], ['疾風迅雷', 'しっぷうじんらい', 'nature'], ['百戦錬磨', 'ひゃくせんれんま', 'battle'],
    ['縦横無尽', 'じゅうおうむじん', 'battle'], ['一石二鳥', 'いっせきにちょう', 'daily'],
  ],
  proverb: [
    ['善は急げ', 'ぜんはいそげ', 'daily'], ['急がば回れ', 'いそがばまわれ', 'daily'], ['七転び八起き', 'ななころびやおき', 'daily'],
    ['猿も木から落ちる', 'さるもきからおちる', 'nature'], ['一寸先は闇', 'いっすんさきはやみ', 'daily'], ['雨降って地固まる', 'あめふってじかたまる', 'nature'],
    ['継続は力なり', 'けいぞくはちからなり', 'daily'], ['石の上にも三年', 'いしのうえにもさんねん', 'daily'],
    ['千里の道も一歩から', 'せんりのみちもいっぽから', 'adventure'], ['塵も積もれば山となる', 'ちりもつもればやまとなる', 'daily'],
  ],
  sentence: [
    ['逃げられない', 'にげられない', 'adventure'], ['地図を広げる', 'ちずをひろげる', 'adventure'], ['お腹が空いた', 'おなかがすいた', 'daily'],
    ['レベルが上がった', 'れべるがあがった', 'game'], ['金貨を拾った', 'きんかをひろった', 'adventure'], ['宝箱を開けた', 'たからばこをあけた', 'adventure'],
    ['呪文を唱えた', 'じゅもんをとなえた', 'magic'], ['仲間が加わった', 'なかまがくわわった', 'adventure'], ['静かな夜の森', 'しずかなよるのもり', 'nature'],
    ['星がきれいな夜', 'ほしがきれいなよる', 'nature'], ['キーボードを叩け', 'きーぼーどをたたけ', 'game'], ['ボスの部屋に着いた', 'ぼすのへやについた', 'adventure'],
    ['扉が開かない', 'とびらがひらかない', 'adventure'], ['魔王が目を覚ました', 'まおうがめをさました', 'monster'], ['スライムが現れた', 'すらいむがあらわれた', 'monster'],
    ['次の階へ進もう', 'つぎのかいへすすもう', 'adventure'], ['指が勝手に動く', 'ゆびがかってにうごく', 'daily'], ['正確さこそ力', 'せいかくさこそちから', 'daily'],
    ['勇者は剣を抜いた', 'ゆうしゃはけんをぬいた', 'battle'], ['罠にかかってしまった', 'わなにかかってしまった', 'adventure'], ['薬草で回復した', 'やくそうでかいふくした', 'magic'],
    ['宝石が光っている', 'ほうせきがひかっている', 'adventure'], ['最後まであきらめない', 'さいごまであきらめない', 'daily'], ['魔法の力が宿る', 'まほうのちからがやどる', 'magic'],
    ['扉の奥に何かいる', 'とびらのおくになにかいる', 'adventure'], ['今日はいい天気ですね', 'きょうはいいてんきですね', 'daily'],
    ['ダンジョンの奥へ進む', 'だんじょんのおくへすすむ', 'adventure'], ['宝の地図を手に入れた', 'たからのちずをてにいれた', 'adventure'],
    ['敵の攻撃をかわした', 'てきのこうげきをかわした', 'battle'], ['ドラゴンが炎を吐いた', 'どらごんがほのおをはいた', 'monster'],
  ],
};

export interface Word {
  display: string;
  reading: string;
  length: number;
  kind: WordKind;
  theme: WordTheme;
}

export const MIN_LENGTH = 3;
export const MAX_LENGTH = 12;

export const WORDS: Word[] = WORD_KINDS.flatMap((kind) =>
  RAW[kind].map(([display, reading, theme]) => ({ display, reading, length: reading.length, kind, theme })),
);

export const WORDS_BY_LENGTH: Map<number, Word[]> = new Map();
for (const w of WORDS) {
  const list = WORDS_BY_LENGTH.get(w.length) ?? [];
  list.push(w);
  WORDS_BY_LENGTH.set(w.length, list);
}
