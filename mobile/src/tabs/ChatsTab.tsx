import styles from "@/styles";
import { View } from "react-native";
import { useTheme, Text } from "react-native-paper";

export default function ChatsTab() {
    const theme = useTheme();

    return (
        <View style={styles(theme).screen}>
            <Text style={styles(theme).screenTitle}>Chats</Text>
            <Text style={styles(theme).screenSubtitle}>Your conversations will appear here</Text>
        </View>
    );
}