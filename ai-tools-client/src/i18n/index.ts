import zhCN from './locales/zh-CN'
import enUS from './locales/en-US'

// 简单的国际化实现
export type Locale = 'zh-CN' | 'en-US'

export interface I18nMessages {
  [key: string]: string | I18nMessages
}

class I18n {
  private currentLocale: Locale = 'zh-CN'
  private messages: Record<Locale, I18nMessages> = {
    'zh-CN': zhCN,
    'en-US': enUS
  }

  constructor() {
    // 从本地存储加载语言设置
    const savedLocale = localStorage.getItem('locale') as Locale | null
    if (savedLocale && ['zh-CN', 'en-US'].includes(savedLocale)) {
      this.currentLocale = savedLocale
    }
    // 设置HTML语言属性
    document.documentElement.lang = this.currentLocale
  }

  // 设置语言
  setLocale(locale: Locale) {
    this.currentLocale = locale
    localStorage.setItem('locale', locale)
    document.documentElement.lang = locale
  }

  // 获取当前语言
  getLocale(): Locale {
    return this.currentLocale
  }

  // 注册翻译消息
  registerMessages(locale: Locale, messages: I18nMessages) {
    this.messages[locale] = { ...this.messages[locale], ...messages }
  }

  // 翻译函数（支持嵌套key，如 "common.submit"）
  t(key: string, params?: Record<string, string | number>): string {
    const keys = key.split('.')
    let value: any = this.messages[this.currentLocale]

    for (const k of keys) {
      if (value && typeof value === 'object') {
        value = value[k]
      } else {
        return key // 未找到翻译，返回key
      }
    }

    if (typeof value === 'string') {
      // 替换参数 {param}
      if (params) {
        return value.replace(/\{(\w+)\}/g, (match, paramKey) => {
          return params[paramKey]?.toString() || match
        })
      }
      return value
    }

    return key
  }
}

// 导出单例
export const i18n = new I18n()

// 导出翻译函数
export const t = i18n.t.bind(i18n)
