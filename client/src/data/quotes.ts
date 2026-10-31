/** 好词好句库：英文名句 + 中文翻译 + 出处（文学、哲学、演讲、谚语等） */
export interface Quote {
  en: string
  zh: string
  source: string
}

export const QUOTES: Quote[] = [
  // —— 文学 ——
  {
    en: 'We are all in the gutter, but some of us are looking at the stars.',
    zh: '我们都身处阴沟，但仍有人仰望星空。',
    source: '奥斯卡·王尔德《温德米尔夫人的扇子》',
  },
  {
    en: 'So we beat on, boats against the current, borne back ceaselessly into the past.',
    zh: '于是我们奋力向前划，逆流而上，小舟被浪潮不断地推回往昔。',
    source: '菲茨杰拉德《了不起的盖茨比》',
  },
  {
    en: 'All happy families are alike; each unhappy family is unhappy in its own way.',
    zh: '幸福的家庭都是相似的，不幸的家庭各有各的不幸。',
    source: '托尔斯泰《安娜·卡列尼娜》',
  },
  {
    en: 'It is only with the heart that one can see rightly; what is essential is invisible to the eye.',
    zh: '只有用心才能看清，本质的东西用眼睛是看不见的。',
    source: '圣埃克苏佩里《小王子》',
  },
  {
    en: 'You become responsible, forever, for what you have tamed.',
    zh: '你要对你所驯服的一切，永远负责。',
    source: '圣埃克苏佩里《小王子》',
  },
  {
    en: 'It was the best of times, it was the worst of times.',
    zh: '这是最好的时代，这是最坏的时代。',
    source: '狄更斯《双城记》',
  },
  {
    en: 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.',
    zh: '有钱的单身汉总要娶位太太，这是一条举世公认的真理。',
    source: '简·奥斯汀《傲慢与偏见》',
  },
  {
    en: 'The mass of men lead lives of quiet desperation.',
    zh: '大多数人过着平静的绝望生活。',
    source: '梭罗《瓦尔登湖》',
  },
  {
    en: 'Go confidently in the direction of your dreams. Live the life you have imagined.',
    zh: '朝你梦想的方向自信前行，去过你想象中的生活。',
    source: '梭罗',
  },
  {
    en: 'The world breaks everyone, and afterward, many are strong at the broken places.',
    zh: '世界会击碎每一个人，但后来，许多人在破碎之处变得坚强。',
    source: '海明威《永别了，武器》',
  },
  {
    en: 'There is nothing noble in being superior to your fellow man; true nobility is being superior to your former self.',
    zh: '优于别人并不高贵，真正的高贵是优于过去的自己。',
    source: '海明威《真实的高贵》',
  },
  {
    en: 'There is no friend as loyal as a book.',
    zh: '没有比书更忠诚的朋友。',
    source: '海明威',
  },
  {
    en: 'I am no bird; and no net ensnares me: I am a free human being with an independent will.',
    zh: '我不是鸟，也没有罗网能困住我；我是一个拥有独立意志的自由人。',
    source: '夏洛蒂·勃朗特《简·爱》',
  },
  {
    en: 'All the world’s a stage, and all the men and women merely players.',
    zh: '世界是一个舞台，所有的男男女女都不过是演员。',
    source: '莎士比亚《皆大欢喜》',
  },
  {
    en: 'This above all: to thine own self be true.',
    zh: '尤其要紧的是：对自己忠实。',
    source: '莎士比亚《哈姆雷特》',
  },
  {
    en: 'Love all, trust a few, do wrong to none.',
    zh: '爱所有人，信任少数人，不伤害任何人。',
    source: '莎士比亚《终成眷属》',
  },
  {
    en: 'We are such stuff as dreams are made on, and our little life is rounded with a sleep.',
    zh: '我们就是梦幻所用的材料，短暂的一生前后都环绕着睡眠。',
    source: '莎士比亚《暴风雨》',
  },
  {
    en: 'To live is the rarest thing in the world. Most people exist, that is all.',
    zh: '生活是世上最稀有的事，大多数人只是存在，仅此而已。',
    source: '王尔德',
  },
  {
    en: 'We read to know we are not alone.',
    zh: '我们读书，是为了知道自己并不孤单。',
    source: '威廉·尼科尔森《影子大地》',
  },
  {
    en: 'Happiness can be found even in the darkest of times, if one only remembers to turn on the light.',
    zh: '即使在最黑暗的时刻，幸福也能被找到，只要你记得把灯点亮。',
    source: 'J.K. 罗琳《哈利·波特》',
  },
  {
    en: 'A book must be the axe for the frozen sea within us.',
    zh: '一本书，必须是劈开我们内心冰封之海的斧头。',
    source: '卡夫卡',
  },
  {
    en: 'Perhaps everything terrible is in its deepest being something helpless that wants help from us.',
    zh: '也许一切可怕之物，在内心深处都是某种无助、渴望我们帮助的东西。',
    source: '里尔克《给青年诗人的信》',
  },
  {
    en: 'Hope is the thing with feathers that perches in the soul.',
    zh: '希望是长着羽毛的东西，栖息在灵魂里。',
    source: '艾米莉·狄金森',
  },
  {
    en: 'Forever is composed of nows.',
    zh: '永恒，是由无数个此刻组成的。',
    source: '艾米莉·狄金森',
  },
  {
    en: 'To see a world in a grain of sand and a heaven in a wild flower.',
    zh: '一沙一世界，一花一天堂。',
    source: '威廉·布莱克',
  },
  {
    en: 'Do not go gentle into that good night.',
    zh: '不要温和地走进那个良夜。',
    source: '狄兰·托马斯',
  },
  {
    en: 'If I should see you, after long year, how should I greet, with tears, with silence.',
    zh: '若我会见到你，事隔经年，我该如何贺你？以眼泪，以沉默。',
    source: '拜伦',
  },
  {
    en: 'Let life be beautiful like summer flowers and death like autumn leaves.',
    zh: '生如夏花之绚烂，死如秋叶之静美。',
    source: '泰戈尔《飞鸟集》',
  },
  {
    en: 'The world has kissed my soul with its pain, asking for its return in songs.',
    zh: '世界以痛吻我，要我报之以歌。',
    source: '泰戈尔《飞鸟集》',
  },
  {
    en: 'The proper function of man is to live, not to exist.',
    zh: '人的正当使命是生活，而不是存在。',
    source: '杰克·伦敦',
  },
  // —— 哲学与思想 ——
  {
    en: 'The unexamined life is not worth living.',
    zh: '未经省察的人生不值得过。',
    source: '苏格拉底',
  },
  {
    en: 'That which does not kill us makes us stronger.',
    zh: '凡不能毁灭我的，必使我更强大。',
    source: '尼采',
  },
  {
    en: 'He who has a why to live can bear almost any how.',
    zh: '一个人知道自己为什么而活，就可以忍受任何一种生活。',
    source: '尼采',
  },
  {
    en: 'We suffer more often in imagination than in reality.',
    zh: '我们受苦，更多是源于想象而非现实。',
    source: '塞内加',
  },
  {
    en: 'Waste no more time arguing about what a good man should be. Be one.',
    zh: '别再浪费时间争论好人该是什么样，去做一个好人。',
    source: '马可·奥勒留《沉思录》',
  },
  {
    en: 'The happiness of your life depends upon the quality of your thoughts.',
    zh: '你生活的幸福，取决于你思想的质量。',
    source: '马可·奥勒留《沉思录》',
  },
  {
    en: 'It’s not what happens to you, but how you react to it that matters.',
    zh: '重要的不是发生了什么，而是你如何回应它。',
    source: '爱比克泰德',
  },
  {
    en: 'No man is free who is not master of himself.',
    zh: '不能主宰自己的人，不是自由人。',
    source: '爱比克泰德',
  },
  {
    en: 'Man is condemned to be free.',
    zh: '人是被判定为自由的。',
    source: '萨特',
  },
  {
    en: 'To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.',
    zh: '在一个不断试图把你变成别人的世界里做你自己，是最大的成就。',
    source: '爱默生',
  },
  {
    en: 'A room without books is like a body without a soul.',
    zh: '没有书的房间，就像没有灵魂的躯体。',
    source: '西塞罗',
  },
  {
    en: 'The wound is the place where the Light enters you.',
    zh: '伤口，正是光进入你内心的地方。',
    source: '鲁米',
  },
  {
    en: 'You were born with wings, why prefer to crawl through life?',
    zh: '你生而有翼，为何竟愿一生匍匐前行？',
    source: '鲁米',
  },
  {
    en: 'What you seek is seeking you.',
    zh: '你所寻找的，也在寻找你。',
    source: '鲁米',
  },
  {
    en: 'Everyone thinks of changing the world, but no one thinks of changing himself.',
    zh: '人人都想改变世界，却没人想改变自己。',
    source: '托尔斯泰',
  },
  {
    en: 'In the depth of winter, I finally learned that within me there lay an invincible summer.',
    zh: '在隆冬，我终于知道，我身上有一个不可战胜的夏天。',
    source: '加缪',
  },
  {
    en: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.',
    zh: '我们重复做的事造就了我们。因此，卓越不是一种行为，而是一种习惯。',
    source: '威尔·杜兰特',
  },
  // —— 东方智慧 ——
  {
    en: 'A journey of a thousand miles begins with a single step.',
    zh: '千里之行，始于足下。',
    source: '老子《道德经》',
  },
  {
    en: 'Knowing others is intelligence; knowing yourself is true wisdom.',
    zh: '知人者智，自知者明。',
    source: '老子《道德经》',
  },
  {
    en: 'He who is contented is rich.',
    zh: '知足者富。',
    source: '老子《道德经》',
  },
  {
    en: 'A leader is best when people barely know he exists.',
    zh: '最好的领导者，人们几乎感觉不到他的存在。',
    source: '老子《道德经》',
  },
  {
    en: 'It does not matter how slowly you go as long as you do not stop.',
    zh: '不怕走得慢，只怕停下来。',
    source: '孔子',
  },
  {
    en: 'Our greatest glory is not in never falling, but in rising every time we fall.',
    zh: '最大的荣耀不在于从不跌倒，而在于每次跌倒后都能重新站起。',
    source: '孔子',
  },
  {
    en: 'Real knowledge is to know the extent of one’s ignorance.',
    zh: '真正的知识，是知道自己的无知。',
    source: '孔子',
  },
  {
    en: 'The man who moves a mountain begins by carrying away small stones.',
    zh: '移山的人，从搬走小石子开始。',
    source: '孔子',
  },
  {
    en: 'The gentleman seeks harmony but not uniformity; the petty man seeks uniformity but not harmony.',
    zh: '君子和而不同，小人同而不和。',
    source: '《论语》',
  },
  {
    en: 'After endless mountains and rivers, one wonders if there is no way out; suddenly, a village appears amid willows and flowers.',
    zh: '山重水复疑无路，柳暗花明又一村。',
    source: '陆游《游山西村》',
  },
  {
    en: 'May we all be blessed with longevity, though thousands of miles apart, we still share the beauty of the moon.',
    zh: '但愿人长久，千里共婵娟。',
    source: '苏轼《水调歌头》',
  },
  {
    en: 'A time will come to ride the wind and break the waves; I will set my sail and cross the vast sea.',
    zh: '长风破浪会有时，直挂云帆济沧海。',
    source: '李白《行路难》',
  },
  {
    en: 'Fall seven times, stand up eight.',
    zh: '七跌八起。',
    source: '日本谚语',
  },
  {
    en: 'This too shall pass.',
    zh: '这一切都会过去。',
    source: '波斯谚语',
  },
  {
    en: 'If you want to go fast, go alone. If you want to go far, go together.',
    zh: '若想走得快，就独自上路；若想走得远，就结伴同行。',
    source: '非洲谚语',
  },
  {
    en: 'A smooth sea never made a skilled sailor.',
    zh: '平静的大海练不出熟练的水手。',
    source: '英国谚语',
  },
  {
    en: 'The best time to plant a tree was twenty years ago. The second best time is now.',
    zh: '种一棵树最好的时间是二十年前，其次是现在。',
    source: '中国谚语',
  },
  // —— 演讲与人物 ——
  {
    en: 'Darkness cannot drive out darkness; only light can do that. Hate cannot drive out hate; only love can do that.',
    zh: '黑暗不能驱走黑暗，只有光可以；仇恨不能驱走仇恨，只有爱可以。',
    source: '马丁·路德·金',
  },
  {
    en: 'The arc of the moral universe is long, but it bends toward justice.',
    zh: '道德宇宙的弧线很长，但它终将弯向正义。',
    source: '马丁·路德·金',
  },
  {
    en: 'Injustice anywhere is a threat to justice everywhere.',
    zh: '任何地方的不公，都是对一切地方正义的威胁。',
    source: '马丁·路德·金《伯明翰狱中书信》',
  },
  {
    en: 'Be the change that you wish to see in the world.',
    zh: '成为你希望在世界上看到的改变。',
    source: '甘地',
  },
  {
    en: 'Where there is love there is life.',
    zh: '哪里有爱，哪里就有生命。',
    source: '甘地',
  },
  {
    en: 'Education is the most powerful weapon which you can use to change the world.',
    zh: '教育是你用来改变世界的最强有力的武器。',
    source: '纳尔逊·曼德拉',
  },
  {
    en: 'It always seems impossible until it’s done.',
    zh: '事情在完成之前，总显得不可能。',
    source: '纳尔逊·曼德拉',
  },
  {
    en: 'Success is not final, failure is not fatal: it is the courage to continue that counts.',
    zh: '成功并非终点，失败也非末日，重要的是继续前行的勇气。',
    source: '温斯顿·丘吉尔',
  },
  {
    en: 'We make a living by what we get, but we make a life by what we give.',
    zh: '我们靠所得谋生，靠给予生活。',
    source: '温斯顿·丘吉尔',
  },
  {
    en: 'The only thing we have to fear is fear itself.',
    zh: '我们唯一需要恐惧的，就是恐惧本身。',
    source: '富兰克林·罗斯福',
  },
  {
    en: 'Ask not what your country can do for you — ask what you can do for your country.',
    zh: '不要问国家能为你做什么，要问你能为国家做什么。',
    source: '约翰·肯尼迪',
  },
  {
    en: 'No one can make you feel inferior without your consent.',
    zh: '没有你的同意，没有人能让你感到卑微。',
    source: '埃莉诺·罗斯福',
  },
  {
    en: 'The future belongs to those who believe in the beauty of their dreams.',
    zh: '未来属于那些相信梦想之美的人。',
    source: '埃莉诺·罗斯福',
  },
  {
    en: 'Do what you can, with what you have, where you are.',
    zh: '在你所在之处，用你所有，尽你所能。',
    source: '西奥多·罗斯福',
  },
  {
    en: 'Comparison is the thief of joy.',
    zh: '比较是偷走快乐的小偷。',
    source: '西奥多·罗斯福',
  },
  {
    en: 'Stay hungry, stay foolish.',
    zh: '求知若饥，虚心若愚。',
    source: '史蒂夫·乔布斯',
  },
  {
    en: 'Your time is limited, so don’t waste it living someone else’s life.',
    zh: '你的时间有限，不要浪费在过别人的生活上。',
    source: '史蒂夫·乔布斯',
  },
  {
    en: 'A woman must have money and a room of her own if she is to write fiction.',
    zh: '一个女人若要写小说，必须有钱和一间属于自己的房间。',
    source: '弗吉尼亚·伍尔夫',
  },
  {
    en: 'There is no greater agony than bearing an untold story inside you.',
    zh: '没有什么比内心藏着一个未说出口的故事更痛苦。',
    source: '玛雅·安吉洛',
  },
  {
    en: 'People will forget what you said, people will forget what you did, but people will never forget how you made them feel.',
    zh: '人们会忘记你说过的话，忘记你做过的事，但永远不会忘记你给他们的感受。',
    source: '玛雅·安吉洛',
  },
  {
    en: 'Keep your face to the sunshine and you cannot see a shadow.',
    zh: '把脸朝向阳光，你就看不见阴影。',
    source: '海伦·凯勒',
  },
  {
    en: 'Life is either a daring adventure or nothing at all.',
    zh: '生活要么是一场大胆的冒险，要么什么都不是。',
    source: '海伦·凯勒',
  },
  {
    en: 'Courage is resistance to fear, mastery of fear — not absence of fear.',
    zh: '勇气是抵抗恐惧、驾驭恐惧，而不是没有恐惧。',
    source: '马克·吐温',
  },
  {
    en: 'The two most important days in your life are the day you are born and the day you find out why.',
    zh: '你生命中最重要的两天，是你出生的那天，和你明白为何而生的那天。',
    source: '马克·吐温',
  },
  // —— 科学与艺术 ——
  {
    en: 'Imagination is more important than knowledge.',
    zh: '想象力比知识更重要。',
    source: '爱因斯坦',
  },
  {
    en: 'Life is like riding a bicycle. To keep your balance, you must keep moving.',
    zh: '生活就像骑自行车，想保持平衡就得不断前行。',
    source: '爱因斯坦',
  },
  {
    en: 'Try not to become a man of success, but rather try to become a man of value.',
    zh: '不要试图成为成功的人，而要努力成为有价值的人。',
    source: '爱因斯坦',
  },
  {
    en: 'The important thing is not to stop questioning.',
    zh: '重要的是不要停止提问。',
    source: '爱因斯坦',
  },
  {
    en: 'I have not failed. I’ve just found 10,000 ways that won’t work.',
    zh: '我并没有失败，我只是找到了一万种行不通的方法。',
    source: '托马斯·爱迪生',
  },
  {
    en: 'Genius is one percent inspiration and ninety-nine percent perspiration.',
    zh: '天才是百分之一的灵感加百分之九十九的汗水。',
    source: '托马斯·爱迪生',
  },
  {
    en: 'The best way to predict the future is to invent it.',
    zh: '预测未来最好的方式，就是把它创造出来。',
    source: '艾伦·凯',
  },
  {
    en: 'Simplicity is the ultimate sophistication.',
    zh: '简约是终极的精致。',
    source: '达·芬奇',
  },
  {
    en: 'Learning never exhausts the mind.',
    zh: '学习永远不会使头脑疲惫。',
    source: '达·芬奇',
  },
  {
    en: 'Everything you can imagine is real.',
    zh: '你能想象的一切，都是真实的。',
    source: '毕加索',
  },
  {
    en: 'Art washes away from the soul the dust of everyday life.',
    zh: '艺术洗去灵魂上日常生活的尘埃。',
    source: '毕加索',
  },
  {
    en: 'Life is what happens when you’re busy making other plans.',
    zh: '生活，就是你忙于制定其他计划时发生的事。',
    source: '约翰·列侬',
  },
  // —— 电影 ——
  {
    en: 'Life is like a box of chocolates. You never know what you’re gonna get.',
    zh: '生活就像一盒巧克力，你永远不知道下一颗是什么味道。',
    source: '电影《阿甘正传》',
  },
  {
    en: 'Carpe diem. Seize the day, boys. Make your lives extraordinary.',
    zh: '把握今朝，孩子们，让你们的人生与众不同。',
    source: '电影《死亡诗社》',
  },
  // —— 短句精选（适合一行展示） ——
  {
    en: 'I think, therefore I am.',
    zh: '我思故我在。',
    source: '笛卡尔',
  },
  {
    en: 'Knowledge is power.',
    zh: '知识就是力量。',
    source: '培根',
  },
  {
    en: 'To be, or not to be: that is the question.',
    zh: '生存还是毁灭，这是一个问题。',
    source: '莎士比亚《哈姆雷特》',
  },
  {
    en: 'Brevity is the soul of wit.',
    zh: '简洁是智慧的灵魂。',
    source: '莎士比亚《哈姆雷特》',
  },
  {
    en: 'All that glitters is not gold.',
    zh: '闪光的未必都是金子。',
    source: '莎士比亚《威尼斯商人》',
  },
  {
    en: 'Cowards die many times before their deaths.',
    zh: '懦夫在死去之前，已经死过许多次。',
    source: '莎士比亚《尤利乌斯·凯撒》',
  },
  {
    en: 'The fault, dear Brutus, is not in our stars, but in ourselves.',
    zh: '亲爱的布鲁图斯，错不在星辰，而在我们自己。',
    source: '莎士比亚《尤利乌斯·凯撒》',
  },
  {
    en: 'Not all those who wander are lost.',
    zh: '并非所有流浪者都迷失了方向。',
    source: '托尔金《魔戒》',
  },
  {
    en: 'Even the smallest person can change the course of the future.',
    zh: '再渺小的人，也能改变未来的走向。',
    source: '托尔金《魔戒》',
  },
  {
    en: 'Knowing yourself is the beginning of all wisdom.',
    zh: '认识自己，是一切智慧的开端。',
    source: '亚里士多德',
  },
  {
    en: 'The only true wisdom is in knowing you know nothing.',
    zh: '唯一真正的智慧，是知道自己一无所知。',
    source: '苏格拉底',
  },
  {
    en: 'Luck is what happens when preparation meets opportunity.',
    zh: '幸运，是准备遇到机会时发生的事。',
    source: '塞内加',
  },
  {
    en: 'While we wait for life, life passes.',
    zh: '当我们等待生活时，生活正在流逝。',
    source: '塞内加',
  },
  {
    en: 'As long as you live, keep learning how to live.',
    zh: '只要活着，就要不断学习如何生活。',
    source: '塞内加',
  },
  {
    en: 'Very little is needed to make a happy life; it is all within yourself.',
    zh: '幸福生活所需甚少，一切都在你自己心中。',
    source: '马可·奥勒留《沉思录》',
  },
  {
    en: 'The best revenge is to be unlike him who performed the injury.',
    zh: '最好的报复，是不要成为那个伤害你的人。',
    source: '马可·奥勒留《沉思录》',
  },
  {
    en: 'No great thing is created suddenly.',
    zh: '伟大的事物，不会一蹴而就。',
    source: '爱比克泰德',
  },
  {
    en: 'Well done is better than well said.',
    zh: '做得好，胜过说得好。',
    source: '本杰明·富兰克林',
  },
  {
    en: 'Where there is a will, there is a way.',
    zh: '有志者，事竟成。',
    source: '英国谚语',
  },
  {
    en: 'Every cloud has a silver lining.',
    zh: '乌云背后，总有一线光明。',
    source: '英国谚语',
  },
  {
    en: 'Actions speak louder than words.',
    zh: '行动胜于言语。',
    source: '英国谚语',
  },
  {
    en: 'Fortune favors the bold.',
    zh: '幸运眷顾勇者。',
    source: '拉丁谚语',
  },
  {
    en: 'The future depends on what you do today.',
    zh: '未来，取决于你今天做什么。',
    source: '甘地',
  },
  {
    en: 'In the middle of difficulty lies opportunity.',
    zh: '困难之中，蕴藏着机会。',
    source: '爱因斯坦',
  },
  {
    en: 'After all, tomorrow is another day.',
    zh: '毕竟，明天又是新的一天。',
    source: '电影《乱世佳人》',
  },
  {
    en: 'With great power comes great responsibility.',
    zh: '能力越大，责任越大。',
    source: '电影《蜘蛛侠》',
  },
]

/**
 * 右下角展示用短句：英文限 72 字符、中文限 36 字，
 * 保证英中两种文字各占一行、不折行（配合样式中的 truncate 兜底）。
 */
export const DISPLAY_QUOTES: Quote[] = QUOTES.filter(
  (q) => q.en.length <= 72 && q.zh.length <= 36,
)
