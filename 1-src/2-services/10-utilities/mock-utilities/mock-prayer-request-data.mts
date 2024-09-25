import { PrayerRequestTagEnum } from "../../../0-assets/field-sync/input-config-sync/prayer-request-field-config.mjs";

/***************************
* PRAYER REQUEST MOCK DATA *
****************************/
export type PrayerRequestDetail = { topic:string, description:string, categoryList:PrayerRequestTagEnum[] };

export const MOCK_PRAYER_REQUESTS:PrayerRequestDetail[] = [
    {
      topic: 'Guidance for Career Choices',
      description: 'I\'m asking for prayers as I navigate some important career decisions. Please pray that I receive clear guidance and discernment from God as I consider my future path.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.SCHOOL],
    },
    {
      topic: 'Healing for My Parent',
      description: 'My parent is going through a tough time with their health. I\'m asking for prayer for their healing and for strength for our family. I believe in God\'s power to restore and comfort.',
      categoryList: [PrayerRequestTagEnum.FAMILY, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Peace for War-Torn Regions',
      description: 'I\'m deeply concerned about the ongoing conflicts around the world. Please join me in praying for peace, protection for the vulnerable, and wisdom for those in positions of power.',
      categoryList: [PrayerRequestTagEnum.GLOBAL, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Thankfulness for New Job',
      description: 'I\'m so grateful for the new job opportunity I\'ve been given. I want to give thanks to God for His provision and ask for continued guidance and strength as I start this new chapter.',
      categoryList: [PrayerRequestTagEnum.PRAISE, PrayerRequestTagEnum.SELF],
    },
    {
      topic: 'Family Reconciliation',
      description: 'I\'m praying for healing and reconciliation in my family. We\'ve had some difficult times, and I ask for God\'s intervention to mend broken relationships and bring us closer together.',
      categoryList: [PrayerRequestTagEnum.FAMILY, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Strength for School Challenges',
      description: 'I\'m facing some tough challenges at school and could use your prayers for strength and perseverance. Please pray that I remain focused and resilient in my studies and personal growth.',
      categoryList: [PrayerRequestTagEnum.SCHOOL, PrayerRequestTagEnum.SELF],
    },
    {
      topic: 'Safe Travels',
      description: 'I\'m about to embark on a long journey and would appreciate your prayers for safety and protection. Please ask God to watch over me and ensure a safe and smooth trip.',
      categoryList: [PrayerRequestTagEnum.SELF],
    },
    {
      topic: 'Support for a Friend',
      description: 'A close friend of mine is going through a rough time. I\'m asking for prayers for their comfort and strength. I hope they feel God\'s presence and find solace in this difficult period.',
      categoryList: [PrayerRequestTagEnum.FAMILY, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Guidance in Financial Struggles',
      description: 'I\'m currently dealing with financial difficulties and need guidance on how to manage my resources wisely. Please pray for God\'s provision and wisdom in overcoming these challenges.',
      categoryList: [PrayerRequestTagEnum.SELF],
    },
    {
      topic: 'Health for My Grandpa',
      description: 'My grandfather has been ill lately, and I\'m praying for their swift recovery. Please join me in asking God for healing and strength for my grandpa and comfort for our whole family.',
      categoryList: [PrayerRequestTagEnum.FAMILY, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Peace of Mind',
      description: 'I\'m struggling with anxiety and stress in my daily life. I would appreciate prayers for peace of mind and emotional healing, trusting in God\'s calming presence and guidance.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Gratitude for Supportive Community',
      description: 'I\'m incredibly thankful for the supportive community around me. Please pray with me to acknowledge and thank God for the friendships and support I\'ve received through this challenging time.',
      categoryList: [PrayerRequestTagEnum.PRAISE],
    },
    {
      topic: 'Success in Academic Endeavors',
      description: 'As I approach important exams, I\'m asking for prayers for success and clarity in my studies. Please pray that I can apply myself effectively and perform to the best of my ability.',
      categoryList: [PrayerRequestTagEnum.SCHOOL, PrayerRequestTagEnum.SELF],
    },
    {
      topic: 'Healing for Chronic Illness',
      description: 'I\'ve been battling a chronic illness for a long time. I\'m seeking your prayers for relief and healing. Please ask God to grant me strength and a renewed sense of hope.',
      categoryList: [PrayerRequestTagEnum.HEALING, PrayerRequestTagEnum.SELF],
    },
    {
      topic: 'Family Unity',
      description: 'I\'m praying for unity and understanding within my family. We\'ve had some conflicts, and I ask for God\'s help in fostering love, patience, and harmony among us.',
      categoryList: [PrayerRequestTagEnum.FAMILY],
    },
    {
      topic: 'Successful Job Interview',
      description: 'I have an important job interview coming up and am seeking prayers for confidence and success. Please pray that I can present myself well and that God\'s favor is upon this opportunity.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.PRAISE],
    },
    {
      topic: 'Support for a Mission Trip',
      description: 'I\'m preparing for a mission trip and would appreciate your prayers for preparation, safety, and impactful ministry. Please ask God to guide and bless the work we will be doing.',
      categoryList: [PrayerRequestTagEnum.GLOBAL, PrayerRequestTagEnum.PRAISE],
    },
    {
      topic: 'Peace During Difficult Times',
      description: 'I\'m going through a period of personal turmoil and need prayers for peace and clarity. Please ask God to grant me comfort and guidance as I navigate these challenging moments.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Safety for a Loved One',
      description: 'A loved one is traveling abroad, and I\'m asking for prayers for their safety and protection. Please pray that God watches over them and ensures a secure and smooth journey.',
      categoryList: [PrayerRequestTagEnum.FAMILY, PrayerRequestTagEnum.GLOBAL],
    },
    {
      topic: 'Wisdom in Decision-Making',
      description: 'I\'m facing a tough decision and need divine wisdom to choose the right path. Please pray that I can discern God\'s will and make decisions that align with His plans for me.',
      categoryList: [PrayerRequestTagEnum.SELF],
    },
    {
      topic: 'Thankful for Blessings',
      description: 'I\'m so grateful for the many blessings in my life and want to thank God for His goodness. Please join me in praising Him for His faithfulness and the joy He brings into my life.',
      categoryList: [PrayerRequestTagEnum.PRAISE],
    },
    {
      topic: 'Recovery from Surgery',
      description: 'I recently had surgery and am in need of prayers for a smooth recovery. Please ask God to heal my body quickly and grant me patience and strength during the healing process.',
      categoryList: [PrayerRequestTagEnum.HEALING, PrayerRequestTagEnum.SELF],
    },
    {
      topic: 'Strength for Caregiving',
      description: 'As a caregiver, I\'m asking for prayers for strength and endurance. Please pray that God grants me the energy and compassion needed to support and care for my loved one.',
      categoryList: [PrayerRequestTagEnum.FAMILY, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Growth in Faith',
      description: 'I\'m seeking prayers for spiritual growth and a deeper connection with God. Please ask Him to help me grow in faith and understanding and to guide me in living out His teachings more fully.',
      categoryList: [PrayerRequestTagEnum.SELF],
    },
    {
      topic: 'Healing for Emotional Wounds',
      description: 'I\'m struggling with some deep emotional wounds and need healing. Please pray that God helps me work through these issues and find peace and wholeness in His presence.',
      categoryList: [PrayerRequestTagEnum.HEALING, PrayerRequestTagEnum.SELF],
    },
    {
      topic: 'Comfort for the Grieving',
      description: 'My friend is grieving the loss of a loved one. Please pray for comfort and peace for them, asking God to wrap them in His love and help them through this painful time.',
      categoryList: [PrayerRequestTagEnum.FAMILY, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Provision for Financial Needs',
      description: 'I\'m facing some financial challenges and need prayers for provision and wisdom. Please ask God to meet my needs and guide me in managing my resources wisely.',
      categoryList: [PrayerRequestTagEnum.SELF],
    },
    {
      topic: 'Praise for Family\'s Health',
      description: 'I\'m thanking God for the good health of my family. I\'m grateful for His protection and blessings. Please join me in celebrating and praising Him for this wonderful gift.',
      categoryList: [PrayerRequestTagEnum.PRAISE, PrayerRequestTagEnum.FAMILY],
    },
    {
      topic: 'Strength to Overcome Addiction',
      description: 'I\'m battling an addiction and am asking for prayers for strength and healing. Please pray that God provides the courage and support needed to overcome this challenge and find freedom.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Healing for a Friend\'s Illness',
      description: 'A dear friend is struggling with a serious illness. I\'m asking for prayers for their healing and recovery. Please pray for comfort and strength for them and their family.',
      categoryList: [PrayerRequestTagEnum.FAMILY, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Peace for a Troubled Heart',
      description: 'I\'m experiencing inner turmoil and am in need of God\'s peace. Please pray that He calms my heart and mind and helps me find solace and clarity in His presence.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Safe Return of a Missionary',
      description: 'A missionary friend is returning home soon. Please pray for their safe journey and for the continued impact of their work. I\'m thankful for their dedication and ask for God\'s blessings on their return.',
      categoryList: [PrayerRequestTagEnum.FAMILY, PrayerRequestTagEnum.GLOBAL],
    },
    {
      topic: 'Guidance for Personal Growth',
      description: 'I\'m seeking guidance for personal growth and development. Please pray that God helps me grow spiritually, emotionally, and mentally, and that I can become more like Him each day.',
      categoryList: [PrayerRequestTagEnum.SELF],
    },
    {
      topic: 'Praise for Improved Relationships',
      description: 'I\'m praising God for the recent improvements in my relationships. I\'m grateful for His work in mending and strengthening bonds with loved ones and ask for continued growth.',
      categoryList: [PrayerRequestTagEnum.PRAISE, PrayerRequestTagEnum.FAMILY],
    },
    {
      topic: 'Direction in Career',
      description: 'I\'m feeling uncertain about my career path and ask for God\'s guidance in making wise decisions. I pray for clarity and peace as I consider new job opportunities and future plans.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.SCHOOL],
    },
    {
      topic: 'Healing for My Father',
      description: 'Please pray for my father, who is battling a serious illness. I ask for God\'s healing hand and strength for my family as we navigate this challenging time together.',
      categoryList: [PrayerRequestTagEnum.FAMILY, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Praying for World Peace',
      description: 'I am deeply troubled by the violence and conflict in the world. I pray for peace, protection of the innocent, and wisdom for global leaders to seek solutions that honor God\'s justice and mercy.',
      categoryList: [PrayerRequestTagEnum.GLOBAL, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Grateful for New Job',
      description: 'I want to praise God for blessing me with a new job. It came at just the right time, and I feel so grateful for His provision and faithfulness during my period of unemployment.',
      categoryList: [PrayerRequestTagEnum.PRAISE, PrayerRequestTagEnum.SELF],
    },
    {
      topic: 'Reconciliation in Family',
      description: 'Please pray for healing in my family. We\'ve been experiencing tension and distance, and I\'m asking God to bring forgiveness, understanding, and restoration between us.',
      categoryList: [PrayerRequestTagEnum.FAMILY, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Strength for Exams',
      description: 'I\'m feeling overwhelmed with upcoming exams and schoolwork. I ask for God\'s strength, focus, and wisdom as I prepare, trusting that He will give me the peace I need to succeed.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.SCHOOL],
    },
    {
      topic: 'Recovery from Surgery',
      description: 'I recently had surgery, and I\'m asking for prayers for a smooth and quick recovery. I pray for healing in my body and strength to get through the recovery process.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Prayers for a Safe Trip',
      description: 'I\'m about to go on a long trip and ask for God\'s protection and guidance as I travel. Please pray that I stay safe and that everything goes smoothly during my journey.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.PRAISE],
    },
    {
      topic: 'Help with Family Finances',
      description: 'Our family is facing financial strain, and I ask for God\'s provision and wisdom to manage our resources wisely. I\'m praying for peace during this stressful time and trust in God\'s faithfulness.',
      categoryList: [PrayerRequestTagEnum.FAMILY, PrayerRequestTagEnum.SELF],
    },
    {
      topic: 'Gratitude for Good Health',
      description: 'I want to thank God for the gift of good health. In a time when so many are struggling, I feel incredibly blessed for the strength and wellness He\'s given me.',
      categoryList: [PrayerRequestTagEnum.PRAISE, PrayerRequestTagEnum.SELF],
    },
    {
      topic: 'Courage in Sharing Faith',
      description: 'I ask for prayers for boldness in sharing my faith with my friends. I feel nervous, but I want to step out and trust God to give me the right words to speak His truth in love.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.GLOBAL],
    },
    {
      topic: 'Healing from Anxiety',
      description: 'I\'ve been struggling with anxiety lately, and I ask for God\'s peace to fill my heart and mind. I pray for strength to manage it and the wisdom to trust Him through my worries.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Prayers for a Broken Friendship',
      description: 'My friendship with someone close to me has been strained, and I\'m asking for prayers for reconciliation. I hope God softens both our hearts and restores what has been broken.',
      categoryList: [PrayerRequestTagEnum.FAMILY, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Support for Teachers',
      description: 'I want to pray for my teachers, especially during these challenging times. They\'ve been working so hard, and I ask God to give them strength, patience, and encouragement as they guide us.',
      categoryList: [PrayerRequestTagEnum.SCHOOL, PrayerRequestTagEnum.PRAISE],
    },
    {
      topic: 'Peace for the Oppressed',
      description: 'My heart breaks for those facing oppression and injustice around the world. I pray for God\'s intervention, justice, and peace for those who suffer, and wisdom for leaders to take action.',
      categoryList: [PrayerRequestTagEnum.GLOBAL, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Thankful for Family',
      description: 'I want to thank God for the blessing of family. Even through tough times, they have been my source of love and support. I praise God for the bond we share and for His faithfulness to us.',
      categoryList: [PrayerRequestTagEnum.FAMILY, PrayerRequestTagEnum.PRAISE],
    },
    {
      topic: 'Healing for a Friend',
      description: 'My close friend is going through a tough health battle, and I ask for prayers for healing. I\'m trusting in God\'s mercy and power to restore them to full health and bring comfort to their family.',
      categoryList: [PrayerRequestTagEnum.FAMILY, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Guidance in Relationships',
      description: 'I ask for God\'s wisdom in my relationships, especially with close friends. I pray for patience, understanding, and discernment in navigating complex situations with grace and love.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.FAMILY],
    },
    {
      topic: 'Support for Missionaries',
      description: 'I want to lift up the missionaries serving around the world, praying that God protects them, gives them strength, and opens hearts to the Gospel. May they be encouraged in their work.',
      categoryList: [PrayerRequestTagEnum.GLOBAL, PrayerRequestTagEnum.PRAISE],
    },
    {
      topic: 'Focus on Studies',
      description: 'I\'ve been struggling with distractions, and I ask for prayers for focus in my schoolwork. I want to use my time wisely and honor God in my studies, trusting Him to guide me through each challenge.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.SCHOOL],
    },
    {
      topic: 'Hope for the Future',
      description: 'I\'m feeling uncertain about my future, especially with all the changes happening in the world. I ask for God\'s guidance and peace, trusting that He has a plan and a purpose for my life.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.PRAISE],
    },
    {
      topic: 'Forgiveness and Healing',
      description: 'I\'ve hurt someone close to me, and I\'m asking for prayers for forgiveness and healing in our relationship. I hope God softens their heart and helps us rebuild the trust that was broken.',
      categoryList: [PrayerRequestTagEnum.FAMILY, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Faith During Uncertainty',
      description: 'I\'m facing a season of uncertainty, and I ask for prayers that my faith would remain strong. I know God is in control, and I trust that He will guide me through this challenging time.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.PRAISE],
    },
    {
      topic: 'Praying for Healing in the World',
      description: 'I pray for God\'s healing over the world, especially those suffering from illness, conflict, and pain. May His love bring peace and restoration to those who are hurting.',
      categoryList: [PrayerRequestTagEnum.GLOBAL, PrayerRequestTagEnum.HEALING],
    },
    {
      topic: 'Grateful for God\'s Provision',
      description: 'I want to thank God for His constant provision. In times of need, He has been faithful to provide, and I\'m incredibly grateful for the ways He has shown up in my life.',
      categoryList: [PrayerRequestTagEnum.PRAISE, PrayerRequestTagEnum.SELF],
    },
    {
      topic: 'Seeking Wisdom in Decisions',
      description: 'I have several important decisions to make, and I\'m asking for God\'s wisdom and clarity. I trust that He will guide my steps and help me choose the right path moving forward.',
      categoryList: [PrayerRequestTagEnum.SELF, PrayerRequestTagEnum.SCHOOL],
    },
    {
      topic: 'Trusting God in Trials',
      description: 'Life has been difficult lately, and I\'m asking for prayers to stay strong in my faith. I know God is with me, but I need His strength and courage to get through this challenging season.',
      categoryList: [PrayerRequestTagEnum.SELF],
    },
  ];
  