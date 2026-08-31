import ExpoModulesCore
import SwiftUI
import FamilyControls

class FamilyActivityPickerProps: ExpoSwiftUI.ViewProps {
    @Field var headerText: String = "Selecione os apps para bloquear"
    let onSelectionChange = EventDispatcher()
}

struct FamilyActivityPickerExpoView: ExpoSwiftUI.View {
    @EnvironmentObject var props: FamilyActivityPickerProps
    @State private var selection = FamilyActivitySelection()

    init(props: FamilyActivityPickerProps) {
        // props are injected via @EnvironmentObject
    }

    var body: some SwiftUI.View {
        FamilyActivityPicker(selection: $selection)
            .onChange(of: selection) { newSelection in
                ManagedSettingsManager.shared.applyShields(newSelection)
                let identifiers = ManagedSettingsManager.shared.blockedTokenIdentifiers()
                props.onSelectionChange([
                    "type": "selectionChanged",
                    "count": newSelection.applicationTokens.count,
                    "identifiers": identifiers
                ])
            }
            .onAppear {
                if let saved = ManagedSettingsManager.shared.currentSelection() {
                    selection = saved
                }
            }
    }
}
