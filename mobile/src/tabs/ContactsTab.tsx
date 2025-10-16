import styles from "@/styles";
import { View } from "react-native";
import { useTheme, Text } from "react-native-paper";

export default function ContactsTab() {
    const theme = useTheme();

    return (
        <View style={styles(theme).screen}>
            <Text style={styles(theme).screenTitle}>Contacts</Text>
            <Text style={styles(theme).screenSubtitle}>Your contacts will appear here</Text>
        </View>
    );
}