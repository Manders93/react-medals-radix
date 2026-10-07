import { useState, useRef, useEffect } from "react";
import Country from "./components/Country";
import Login from "./components/Login";
import Logout from "./components/Logout";
import {
  Theme,
  Button,
  Flex,
  Heading,
  Badge,
  Container,
  Grid,
  Text,
  Tooltip,
} from "@radix-ui/themes";
import { SunIcon, MoonIcon } from "@radix-ui/react-icons";
import "@radix-ui/themes/styles.css";
import "./App.css";
import NewCountry from "./components/NewCountry";
import { HubConnectionBuilder } from "@microsoft/signalr";
import { getUser } from "./Utils.js";

// Your Azure REST API
const API_URL =
  "https://olympicmedalapi-as-a7fyh7afemddagcf.westus-01.azurewebsites.net/api/country";
  //"https://olympicmedalapi-as-a7fyh7afemddagcf.westus-01.azurewebsites.net/jwtapi/country";

// Your Azure SignalR Hub
const HUB_URL =
  "https://olympicmedalapi-as-a7fyh7afemddagcf.westus-01.azurewebsites.net/medalsHub";

// Teacher's JWT login API
const USER_URL =
  "https://jwtswagger.azurewebsites.net/api/user/login";

function App() {
  const [appearance, setAppearance] = useState("dark");
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connection, setConnection] = useState(null);

  // Teacher's user/permission state
  const [user, setUser] = useState({
    name: null,
    authenticated: false,
    canPost: false,
    canPatch: false,
    canDelete: false,
  });

  const medals = useRef([
    { id: 1, name: "gold", color: "#FFD700" },
    { id: 2, name: "silver", color: "#C0C0C0" },
    { id: 3, name: "bronze", color: "#CD7F32" },
  ]);

  // Keep a reference to the latest countries state
  // so SignalR can access the current list
  const latestCountries = useRef(null);
  latestCountries.current = countries;

  // Load countries and create SignalR connection
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

        if (!Array.isArray(data)) {
          throw new Error("The API did not return a list of countries.");
        }

        // Save the original medal counts
        const newCountries = data.map((country) => {
          const newCountry = {
            id: country.id,
            name: country.name,
          };

          medals.current.forEach((medal) => {
            const count = country[medal.name];

            newCountry[medal.name] = {
              page_value: count,
              saved_value: count,
            };
          });

          return newCountry;
        });

        setCountries(newCountries);
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

    // Check for an existing JWT token
    const encoded = localStorage.getItem("token");

    if (encoded) {
      try {
        setUser(getUser(encoded));
      } catch (err) {
        console.error("Invalid token:", err);
        localStorage.removeItem("token");
      }
    }

    // Create SignalR connection
    const newConnection = new HubConnectionBuilder()
      .withUrl(HUB_URL)
      .withAutomaticReconnect()
      .build();

    setConnection(newConnection);
  }, []);

  // Connect to SignalR and listen for database changes
  useEffect(() => {
    if (connection) {
      connection
        .start()
        .then(() => {
          console.log("Connected to SignalR!");

          // Country added
          connection.on("ReceiveAddMessage", (country) => {
            console.log(`Add: ${country.name}`);

            const newCountry = {
              id: country.id,
              name: country.name,
            };

            medals.current.forEach((medal) => {
              const count = country[medal.name];

              newCountry[medal.name] = {
                page_value: count,
                saved_value: count,
              };
            });

            const mutableCountries = [...latestCountries.current];

            setCountries([...mutableCountries, newCountry]);
          });

          // Country deleted
          connection.on("ReceiveDeleteMessage", (id) => {
            console.log(`Delete id: ${id}`);

            const mutableCountries = [...latestCountries.current];

            setCountries(
              mutableCountries.filter((country) => country.id !== id)
            );
          });

          // Country updated
          connection.on("ReceivePatchMessage", (country) => {
            console.log(`Patch: ${country.name}`);

            const updatedCountry = {
              id: country.id,
              name: country.name,
            };

            medals.current.forEach((medal) => {
              const count = country[medal.name];

              updatedCountry[medal.name] = {
                page_value: count,
                saved_value: count,
              };
            });

            const mutableCountries = [...latestCountries.current];

            const idx = mutableCountries.findIndex(
              (c) => c.id === country.id
            );

            if (idx !== -1) {
              mutableCountries[idx] = updatedCountry;
            }

            setCountries(mutableCountries);
          });
        })
        .catch((error) => {
          console.error("SignalR connection failed:", error);
        });
    }
  }, [connection]);

  function toggleAppearance() {
    setAppearance((current) =>
      current === "light" ? "dark" : "light"
    );
  }

  // Login using teacher's JWT API
  async function handleLogin(username, password) {
    try {
      const response = await fetch(USER_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 400) {
          alert("Login failed");
        } else {
          console.error("Login failed:", response.status);
        }

        return;
      }

      const data = await response.json();
      const encoded = data.token;

      localStorage.setItem("token", encoded);
      setUser(getUser(encoded));
    } catch (err) {
      console.error("Login request failed:", err);
      alert("Login failed");
    }
  }

  // Logout
  function handleLogout() {
    localStorage.removeItem("token");

    setUser({
      name: null,
      authenticated: false,
      canPost: false,
      canPatch: false,
      canDelete: false,
    });
  }

  // Add a country to the database
  async function handleAdd(name) {
    try {
      setError("");

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          name: name.trim(),
        }),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          alert("You are not authorized to complete this request");
          return;
        }

        throw new Error(`Failed to add country: ${response.status}`);
      }

      // Refresh the list from the database
      const getResponse = await fetch(API_URL);

      if (!getResponse.ok) {
        throw new Error(
          "Country was added, but the list could not refresh."
        );
      }

      const data = await getResponse.json();

      const newCountries = data.map((country) => {
        const newCountry = {
          id: country.id,
          name: country.name,
        };

        medals.current.forEach((medal) => {
          const count = country[medal.name];

          newCountry[medal.name] = {
            page_value: count,
            saved_value: count,
          };
        });

        return newCountry;
      });

      setCountries(newCountries);
    } catch (err) {
      console.error("Error adding country:", err);
      setError(
        "Could not add the country. Check the API connection and try again."
      );
    }
  }

  // Delete a country from the database
  async function handleDelete(id) {
    const originalCountries = countries;

    // Optimistically remove from the page
    setCountries(countries.filter((country) => country.id !== id));

    try {
      setError("");

      const response = await fetch(`${API_URL}/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          console.log(
            "The record does not exist - it may have already been deleted"
          );
          return;
        }

        if (response.status === 401 || response.status === 403) {
          alert("You are not authorized to complete this request");
          setCountries(originalCountries);
          return;
        }

        throw new Error(`Failed to delete country: ${response.status}`);
      }
    } catch (err) {
      console.error("Error deleting country:", err);
      setCountries(originalCountries);
      setError(
        "Could not delete the country. Check the API connection and try again."
      );
    }
  }

  // Medal changes only change page_value
  function handleIncrement(countryId, medalName) {
    const idx = countries.findIndex((c) => c.id === countryId);
    const mutableCountries = [...countries];

    mutableCountries[idx][medalName].page_value += 1;

    setCountries(mutableCountries);
  }

  function handleDecrement(countryId, medalName) {
    const idx = countries.findIndex((c) => c.id === countryId);
    const mutableCountries = [...countries];

    mutableCountries[idx][medalName].page_value -= 1;

    setCountries(mutableCountries);
  }

  // Save changed medal counts
  async function handleSave(countryId) {
    const originalCountries = countries;

    const idx = countries.findIndex((c) => c.id === countryId);
    const mutableCountries = [...countries];
    const country = mutableCountries[idx];

    let jsonPatch = [];

    medals.current.forEach((medal) => {
      if (
        country[medal.name].page_value !==
        country[medal.name].saved_value
      ) {
        jsonPatch.push({
          op: "replace",
          path: medal.name,
          value: country[medal.name].page_value,
        });

        country[medal.name].saved_value =
          country[medal.name].page_value;
      }
    });

    console.log(
      `json patch for id: ${countryId}: ${JSON.stringify(jsonPatch)}`
    );

    // Update state
    setCountries(mutableCountries);

    try {
      const response = await fetch(`${API_URL}/${countryId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(jsonPatch),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          alert("You are not authorized to complete this request");
          window.location.reload(false);
          return;
        }

        if (response.status === 404) {
          console.log(
            "The record does not exist - it may have already been deleted"
          );
          return;
        }

        throw new Error(
          `Failed to update country: ${response.status}`
        );
      }
    } catch (err) {
      console.error("Error updating country:", err);
      alert("An error occurred while updating");
      setCountries(originalCountries);
    }
  }

  // Reset page values back to saved values
  function handleReset(countryId) {
    const idx = countries.findIndex((c) => c.id === countryId);
    const mutableCountries = [...countries];
    const country = mutableCountries[idx];

    medals.current.forEach((medal) => {
      country[medal.name].page_value =
        country[medal.name].saved_value;
    });

    setCountries(mutableCountries);
  }

  function getAllMedalsTotal() {
    let sum = 0;

    medals.current.forEach((medal) => {
      sum += countries.reduce(
        (total, country) =>
          total + country[medal.name].page_value,
        0
      );
    });

    return sum;
  }

  return (
    <Theme appearance={appearance}>
      <Tooltip
  content={
    appearance === "dark"
      ? "Switch to light mode"
      : "Switch to dark mode"
  }
>
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
</Tooltip>

      {/* Teacher's Login / Logout */}
      {user.authenticated ? (
        <Logout onLogout={handleLogout} />
      ) : (
        <Login onLogin={handleLogin} />
      )}

      <Flex p="2" pl="8" className="fixedHeader" justify="between">
        <Heading size="6">
          Olympic Medals
          <Badge variant="outline" ml="2">
            <Heading size="6">{getAllMedalsTotal()}</Heading>
          </Badge>
        </Heading>

        {/* Only users with medals-post permission can add */}
        {user.canPost && <NewCountry onAdd={handleAdd} />}
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
                canDelete={user.canDelete}
                canPatch={user.canPatch}
                onDelete={handleDelete}
                onSave={handleSave}
                onReset={handleReset}
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