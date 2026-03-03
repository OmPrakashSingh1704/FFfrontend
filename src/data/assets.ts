export const assets = {
  images: {
    founders: [
      'https://images.unsplash.com/photo-1616835240434-d91feb116120?crop=entropy&cs=srgb&fm=jpg&q=85',
      'https://images.unsplash.com/photo-1636293875439-b3125c0f1fc1?crop=entropy&cs=srgb&fm=jpg&q=85',
      'https://images.unsplash.com/photo-1638983752157-052aa1f15bf1?crop=entropy&cs=srgb&fm=jpg&q=85'
    ],
    investors: [
      'https://images.unsplash.com/photo-1468254095679-bbcba94a7066?crop=entropy&cs=srgb&fm=jpg&q=85',
      'https://images.unsplash.com/photo-1591522810896-cb5f45acb9a1?crop=entropy&cs=srgb&fm=jpg&q=85',
      'https://images.unsplash.com/photo-1559067096-49ebca3406aa?crop=entropy&cs=srgb&fm=jpg&q=85'
    ],
    startups: [
      'https://images.unsplash.com/photo-1737573744382-73c017a9ab25?crop=entropy&cs=srgb&fm=jpg&q=85',
      'https://images.unsplash.com/photo-1737729991003-521d47240eb3?crop=entropy&cs=srgb&fm=jpg&q=85',
      'https://images.unsplash.com/photo-1603201667141-5a2d4c673378?crop=entropy&cs=srgb&fm=jpg&q=85'
    ],
    backgrounds: [
      'https://images.unsplash.com/photo-1761645502922-fe3dde9f7341?crop=entropy&cs=srgb&fm=jpg&q=85',
      'https://images.unsplash.com/photo-1762279389006-43963a0cee55?crop=entropy&cs=srgb&fm=jpg&q=85',
      'https://images.unsplash.com/photo-1764258560300-2346b28b4e7c?crop=entropy&cs=srgb&fm=jpg&q=85'
    ]
  },
  icons: 'Use lucide-react. Stroke width 1.5px for elegance.'
} as const

export type AssetLibrary = typeof assets
