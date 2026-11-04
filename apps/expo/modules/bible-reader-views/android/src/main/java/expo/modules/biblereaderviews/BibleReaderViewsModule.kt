package expo.modules.biblereaderviews

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class BibleReaderViewsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BibleReaderViews")

    View(BibleReaderViewsView::class) {
      Events("onReaderEvent")

      Prop("document") { view: BibleReaderViewsView, json: String -> view.setDocumentJson(json) }
      Prop("command") { view: BibleReaderViewsView, json: String? -> view.setCommandJson(json) }
    }
  }
}
