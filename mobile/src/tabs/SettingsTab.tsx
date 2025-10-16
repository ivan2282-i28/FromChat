import styles from "@/styles";
import { View } from "react-native";
import { useTheme, Text } from "react-native-paper";

export default function SettingsTab() {
    const theme = useTheme();

    return (
        <View style={styles(theme).screen}>
            <Text style={styles(theme).screenTitle}>Settings</Text>
            <Text style={styles(theme).screenSubtitle}>App settings will appear here</Text>
        </View>
    );
}