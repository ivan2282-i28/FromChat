import { StyleSheet, Text, View } from 'react-native';
import { PaperProvider } from 'react-native-paper';

export default function App() {
    return (
        <PaperProvider>
            <View style={styles.container}>
                <Text style={styles.title}>FromChat Mobile</Text>
                <Text style={styles.subtitle}>Coming Soon</Text>
            </View>
        </PaperProvider>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: '#666',
    },
});
