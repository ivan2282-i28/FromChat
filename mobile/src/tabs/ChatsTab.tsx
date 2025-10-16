import { View } from "react-native";
import { Appbar } from "react-native-paper";

export default function ChatsTab() {
    return (
        <View>
            <Appbar.Header>
                <Appbar.Content title="Chats" />
            </Appbar.Header>
        </View>
    );
}