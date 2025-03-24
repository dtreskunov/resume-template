import fs from 'fs'
import path from 'path'

import { EleventyHtmlBasePlugin } from '@11ty/eleventy'
import pluginRss from '@11ty/eleventy-plugin-rss'
import markdownIt from 'markdown-it'
import markdownItAttrs from 'markdown-it-attrs'
import pluginIcons from 'eleventy-plugin-icons'

import * as filters from './utils/filters.js'
import * as transforms from './utils/transforms.js'
import * as shortcodes from './utils/shortcodes.js'
import exportToPdf from './utils/plugins/exportToPdf.js'
import localizeFontsCss from './utils/plugins/localizeFontsCss.js'

import meta from './src/data/meta.json' with { type: 'json' };

/**
 * @param {import('@11ty/eleventy').UserConfig} config 
 */
export default async function (config) {
    const BASE_URL = new URL(meta.url)
    const PATH_PREFIX = process.env.PATH_PREFIX || BASE_URL.pathname
    const BUILD_OUTPUT_DIR = process.env.BUILD_OUTPUT_DIR || 'dist'
    const BUILD_ENV = process.env.BUILD_ENV || 'env'

    // Plugins
    config.addPlugin(EleventyHtmlBasePlugin)
    config.addPlugin(pluginRss)

    config.addPlugin(pluginIcons, {
        mode: 'sprite',
        sources: [
            {name: 'custom', path: 'src/assets/icons', default: true},
            {name: 'tabler', path: 'node_modules/@tabler/icons/icons'},
        ],
        sprite: {
            shortcode: 'svgSprite',
            writeFile: 'assets/images/icons.svg',
            attributes: {
                'class': 'svg-sprite',
                'aria-hidden': true,
                'style': 'display:none',
            },
        },
    })
    config.addPlugin(exportToPdf)
    config.addPlugin(localizeFontsCss)

    // Filters
    Object.entries(filters).forEach(([filterName, filter]) => {
        config.addFilter(filterName, filter)
    })

    // Transforms
    Object.entries(transforms).forEach(([transformName, transform]) => {
        config.addTransform(transformName, transform)
    })

    // Shortcodes
    Object.entries(shortcodes).forEach(([shortcodeName, shortcode]) => {
        if (shortcode.paired) {
            config.addPairedShortcode(shortcodeName, shortcode)
        } else {
            config.addShortcode(shortcodeName, shortcode)
        }
    })

    // Asset Watch Targets
    config.addWatchTarget('./src/assets')

    // Markdown
    config.setLibrary(
        'md',
        markdownIt({
            html: true,
            breaks: true,
            linkify: true,
            typographer: true
        }).use(markdownItAttrs)
    )

    // Layouts
    config.addLayoutAlias('base', 'base.njk')
    config.addLayoutAlias('resume', 'resume.njk')

    // Collections customized with special filtering and sorting functions
    const inEntryFolder = (name) => {
        return (item) => path.dirname(item.inputPath).endsWith('/' + name)
    }
    const byFilename = (a, b) => path.basename(a.inputPath).localeCompare(path.basename(b.inputPath))
    const bySortKey = (key) => {
        return (a, b) => {
            if (a.data[key] && b.data[key]) {
                return a.data[key] - b.data[key]
            }
            return 0
        }
    }

    const specialCollections = {
        work: {
            filter: inEntryFolder('work'),
            sort: bySortKey('start')
        },
        education: {
            filter: inEntryFolder('education'),
            sort: bySortKey('start')
        },
        custom: {
            filter: inEntryFolder('custom'),
            sort: byFilename
        }
    }
    for (const [name, {filter, sort}] of Object.entries(specialCollections)) {
        config.addCollection(name, collection => collection
            .getAllSorted()
            .filter(filter)
            .sort(sort)
        )
    }

    // Pass-through files
    config.addPassthroughCopy('src/robots.txt')
    config.addPassthroughCopy('src/assets/images')
    config.addPassthroughCopy('src/assets/fonts')

    // Deep-Merge
    config.setDataDeepMerge(true)

    // Migrate to Eleventy v1
    config.setLiquidOptions({
        strictFilters: false,
        dynamicPartials: false,
    });

    const cssVariables = {
        'path-prefix': PATH_PREFIX,
        'primary-color': meta.colors.primary,
        'secondary-color': meta.colors.secondary
    }
    config.addGlobalData('additionalCss', Object.entries(cssVariables)
        .map( ([name, val]) => `--${name}:${val}` ).join(';'))

    {
        const buildEnvData = {
            PATH_PREFIX: PATH_PREFIX
        }
        const buildEnvContents = Object.entries(buildEnvData)
            .map(([key, value]) => key + "=" + value)
            .join('\n')
        fs.mkdirSync(path.dirname(BUILD_ENV), { recursive: true })
        fs.appendFileSync(BUILD_ENV, buildEnvContents)
    }

    // Base Config
    return {
        pathPrefix: PATH_PREFIX,
        dir: {
            input: 'src',
            output: BUILD_OUTPUT_DIR,
            includes: 'includes',
            layouts: 'layouts',
            data: 'data'
        },
        templateFormats: ['njk', 'md', '11ty.js'],
        htmlTemplateEngine: 'njk',
        markdownTemplateEngine: 'njk'
    }
}
