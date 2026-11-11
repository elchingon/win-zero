// The widgets' native side (modules/widgets), for Win Zero Plus only: this is its only importer, and
// it's required behind the variant. Null where the build has no widgets module.
import Widgets from '../../../modules/widgets';

export const widgetsNative = Widgets;
