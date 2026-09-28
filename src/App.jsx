
import { useState, useRef, useEffect } from "react";
import Country from "./components/Country";
import {
  Theme,
  Button,
  Flex,
  Heading,
  Badge,
  Container,
  Grid,
  Text,
} from "@radix-ui/themes";
import { SunIcon, MoonIcon } from "@radix-ui/react-icons";
import "@radix-ui/themes/styles.css";
import "./App.css";
import NewCountry from "./components/NewCountry";

// Your Azure REST API
const API_URL =
  "https://olympicmedalapi-as-a7fyh7afemddagcf.westus-01.azurewebsites.net/api/country";

function App() {
  const [appearance, setAppearance] = useState("dark");
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const medals = useRef([
    { id: 1, name: "gold", color: "#FFD700" },
    { id: 2, name: "silver", color: "#C0C0C0" },
    { id: 3, name: "bronze", color: "#CD7F32" },
  ]);

  // Load countries from the database when the app opens
  useEffect(() => {
    async function loadCountries() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(API_URL);

        if (!response.ok) {
          throw new Error(`Failed to load countries: ${response.status}`);
        }

        const data = await response.json();

        // Make sure the response is an array
        if (!Array.isArray(data)) {
          throw new Error("The API did not return a list of countries.");
        }

        setCountries(data);
      } catch (err) {
        console.error("Error loading countries:", err);
        setError(
          "Could not load countries from the API. Check that your API is running and allows CORS."
        );
      } finally {
        setLoading(false);
      }
    }

    loadCountries();
  }, []);

  function toggleAppearance() {
    setAppearance((current) =>
      current === "light" ? "dark" : "light"
    );
  }

  // Add a country to the database
  async function handleAdd(name) {
    try {
      setError("");

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: name.trim(),
          gold: 0,
          silver: 0,
          bronze: 0,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to add country: ${response.status}`);
      }

      // Refresh the list from the database so we get the real ID
      const getResponse = await fetch(API_URL);

      if (!getResponse.ok) {
        throw new Error("Country was added, but the list could not refresh.");
      }

      const data = await getResponse.json();
      setCountries(data);
    } catch (err) {
      console.error("Error adding country:", err);
      setError(
        "Could not add the country. Check the API connection and try again."
      );
    }
  }

  // Delete a country from the database
  async function handleDelete(id) {
    try {
      setError("");

      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error(`Failed to delete country: ${response.status}`);
      }

      // Remove it from the React list after successful deletion
      setCountries((current) =>
        current.filter((country) => country.id !== id)
      );
    } catch (err) {
      console.error("Error deleting country:", err);
      setError(
        "Could not delete the country. Check the API connection and try again."
      );
    }
  }

  // Medal changes stay in React state only.
  // They are NOT sent to the API or saved to the database.
  function handleIncrement(countryId, medalName) {
    setCountries((current) =>
      current.map((country) =>
        country.id === countryId
          ? { ...country, [medalName]: country[medalName] + 1 }
          : country
      )
    );
  }

  function handleDecrement(countryId, medalName) {
    setCountries((current) =>
      current.map((country) =>
        country.id === countryId
          ? { ...country, [medalName]: country[medalName] - 1 }
          : country
      )
    );
  }

  function getAllMedalsTotal() {
    return medals.current.reduce(
      (sum, medal) =>
        sum +
        countries.reduce(
          (total, country) => total + (country[medal.name] || 0),
          0
        ),
      0
    );
  }

  return (
    <Theme appearance={appearance}>
      <Button
        onClick={toggleAppearance}
        style={{
          position: "fixed",
          bottom: 20,
          right: 20,
          zIndex: 100,
        }}
        variant="ghost"
      >
        {appearance === "dark" ? <MoonIcon /> : <SunIcon />}
      </Button>

      <Flex p="2" pl="8" className="fixedHeader" justify="between">
        <Heading size="6">
          Olympic Medals
          <Badge variant="outline" ml="2">
            <Heading size="6">{getAllMedalsTotal()}</Heading>
          </Badge>
        </Heading>

        <NewCountry onAdd={handleAdd} />
      </Flex>

      <Container className="bg"></Container>

      {error && (
        <Text color="red" align="center" mt="4">
          {error}
        </Text>
      )}

      {loading ? (
        <Text align="center" mt="4">
          Loading countries from database...
        </Text>
      ) : (
        <Grid pt="2" gap="2" className="grid-container">
          {[...countries]
            .sort((a, b) => a.name.localeCompare(b.name))
            .map((country) => (
              <Country
                key={country.id}
                country={country}
                medals={medals.current}
                onDelete={handleDelete}
                onIncrement={handleIncrement}
                onDecrement={handleDecrement}
              />
            ))}
        </Grid>
      )}
    </Theme>
  );
}

export default App;