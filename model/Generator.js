var fs = require('fs')
, Path = require('path')
, glob = require('glob')
, _ = require('lodash')
, yaml = require('js-yaml')
, config = require('../config')
, rimraf = require('rimraf')
, mkdirp = require('mkdirp')

var Page = require('./Page')

var Self = function (renderer) {
  var self = this
  self.renderer = renderer
  self.site = {data: {}}
  self.pages = []
  self.layouts = {}
  self.readLayouts()
  self.readData()
  console.log(self.site);

  rimraf.sync(config.output_dir)

  self.specialSections = ['data', 'tag']
  self.sections = _.map(glob.sync('*/', {cwd: 'content'}), function (path) {
    return path.replace('/', '')
  })
  self.sections = _.difference(self.sections, self.specialSections)
  _.each(self.sections, function (section) {
    self.processSection(section)
  })
}

Self.prototype.readLayouts = function () {
  var self = this

  var files = glob.sync('layout/*.html')
  _.each(files, function (filename) {
    var name = Path.basename(filename, Path.extname(filename))
    var s = fs.readFileSync(filename, 'utf8')
    var layout = self.parse(s)
    if (layout.content) {
      layout.template = self.renderer.compile(layout.content)
      self.layouts[name] = layout
    }
  })
  //TODO layout may be a partial
}

Self.prototype.readData = function () {
  var self = this

  var files = glob.sync(Path.join(config.content_dir, 'data/*'))
  _.each(files, function (filename) {
    var name = Path.basename(filename, Path.extname(filename))
    var s = fs.readFileSync(filename, 'utf8')
    var data = yaml.load(s, 'utf8')
    self.site.data[name] = data
    if (name === 'tag') self.site.tag = data
  })
}

Self.prototype.processSection = function (section) {
  var self = this

  var folderPath = Path.join(config.content_dir, section)
  var files = glob.sync('**/*.html', {cwd: folderPath})

  var pages = _.map(files, function (filename) {
    return self.read(Path.join(folderPath, filename))
  })

  pages = _.compact(pages)
  _.each(pages, function (page) {
    self.pages.push(page)
    self.render(page)
    self.write(page)
  })
}

Self.prototype.read = function (path) {
  var self = this

  var s = fs.readFileSync(path, 'utf8')
  if (!s) return
  var parsed = self.parse(s)
  var path = Path.relative(config.content_dir, path)
  return new Page(path, parsed, config)
}

Self.prototype.parse = function (s) {
  var self = this
  , data = s.split('---')
  
  if (!s.match('---')) return {content: s}

  var parsed = yaml.load(data[1], 'utf8')
  parsed.content = data[2]

  return parsed
}

Self.prototype.render = function (page) {
  var self = this
  , layout = self.layouts[page.layout]
  , content

  if (!layout) throw ('Layout "' + page.layout + '" is not present')

  if (page.content)
    content = self.renderer.compile(page.content)(page)

  page.html = layout.template({
    page: page
  , content: content
  })
    
  var parentLayout = self.layouts[layout.layout]
  if (parentLayout)
    page.html = parentLayout.template({page: page, content: page.html})
}

Self.prototype.write = function (page) {
  var self = this
  //TODO do not create folder for single html
  mkdirp.sync(Path.join(config.output_dir, page.name))

  var filename = Path.join(config.output_dir, page.permalink)
  fs.writeFileSync(filename, page.html)
}

module.exports = Self
