import { MD3Theme } from "react-native-paper";
import { StyleSheet } from "react-native";

export default function styles(theme: MD3Theme) {
    return StyleSheet.create({
        screen: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            backgroundColor: theme.colors.surface
        },
        screenTitle: {
            fontSize: 24,
            fontWeight: 'bold',
            marginBottom: 8,
            color: theme.colors.onSurface
        },
        screenSubtitle: {
            fontSize: 16,
            textAlign: 'center',
            color: theme.colors.onSurfaceVariant
        }
    });
}