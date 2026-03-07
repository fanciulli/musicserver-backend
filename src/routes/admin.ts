/*
 * Created on Fri Mar 06 2026
 *
 * Author: Massimiliano Fanciulli
 *
 * GitHub: https://github.com/fanciulli
 */
import { Route } from "../types/route.js";

const adminPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Music Server Admin</title>
    <link href="https://cdn.jsdelivr.net/npm/@tabler/core@1.4.0/dist/css/tabler.min.css" rel="stylesheet" />
  </head>
  <body>
    <div class="page">
      <header class="navbar navbar-expand-md d-print-none">
        <div class="container-xl">
          <h1 class="navbar-brand navbar-brand-autodark">Music Server Admin</h1>
        </div>
      </header>
      <div class="page-wrapper">
        <div class="page-header d-print-none">
          <div class="container-xl">
            <div class="row g-2 align-items-center">
              <div class="col">
                <h2 class="page-title">Installed Plugins</h2>
              </div>
            </div>
          </div>
        </div>
        <div class="page-body">
          <div class="container-xl">
            <div class="card">
              <div class="table-responsive">
                <table class="table table-vcenter card-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Category</th>
                      <th>Status</th>
                      <th class="w-1">Actions</th>
                    </tr>
                  </thead>
                  <tbody id="pluginsTableBody"></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        <footer class="footer footer-transparent">
          <div class="container-xl text-center text-secondary py-3">
            &copy; 2026 Massimiliano Fanciulli - fanciulli@gmail.com
          </div>
        </footer>
      </div>
    </div>
    <script>
      const tableBody = document.getElementById("pluginsTableBody");

      function isActive(plugin) {
        return plugin.status === "started";
      }

      function statusBadge(plugin) {
        if (isActive(plugin)) {
          return '<span class="status status-green">active</span>';
        }

        if (plugin.status === "unknown") {
          return '<span class="status status-yellow">unknown</span>';
        }

        return '<span class="status status-red">' + plugin.status + '</span>';
      }

      function canScan(plugin) {
        return (
          plugin.category === "music_services" ||
          plugin.category === "music_sources"
        );
      }

      async function performScan(pluginId, button) {
        button.disabled = true;
        const previousText = button.innerText;
        button.innerText = "Scanning...";

        try {
          const response = await fetch("/scan", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ id: pluginId }),
          });

          if (!response.ok) {
            throw new Error("scan failed");
          }

          button.innerText = "Done";
        } catch {
          button.innerText = "Error";
        } finally {
          setTimeout(() => {
            button.disabled = false;
            button.innerText = previousText;
          }, 1200);
        }
      }

      async function performStop(pluginId, button) {
        button.disabled = true;
        const previousText = button.innerText;
        button.innerText = "Stopping...";

        try {
          const response = await fetch("/plugins/stop", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ pluginId }),
          });

          if (!response.ok) {
            throw new Error("stop failed");
          }

          button.innerText = "Done";
          await loadPlugins();
        } catch {
          button.innerText = "Error";
        } finally {
          setTimeout(() => {
            button.disabled = false;
            button.innerText = previousText;
          }, 1200);
        }
      }

      async function performStart(pluginId, button) {
        button.disabled = true;
        const previousText = button.innerText;
        button.innerText = "Starting...";

        try {
          const response = await fetch("/plugins/start", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ pluginId }),
          });

          if (!response.ok) {
            throw new Error("start failed");
          }

          button.innerText = "Done";
          await loadPlugins();
        } catch {
          button.innerText = "Error";
        } finally {
          setTimeout(() => {
            button.disabled = false;
            button.innerText = previousText;
          }, 1200);
        }
      }

      function rowHtml(plugin) {
        let actionsHtml =
          '<button class="btn btn-outline-success btn-sm" data-action="start" data-plugin-id="' + plugin.id + '">Start</button>';

        if (isActive(plugin)) {
          const scanDisabled = canScan(plugin) ? "" : "disabled";
          actionsHtml =
            '<button class="btn btn-primary btn-sm me-2" ' + scanDisabled + ' data-action="scan" data-plugin-id="' + plugin.id + '">Scan</button>' +
            '<button class="btn btn-outline-danger btn-sm" data-action="stop" data-plugin-id="' + plugin.id + '">Stop</button>';
        }

        return (
          '<td>' + plugin.name + '</td>' +
          '<td>' + plugin.category + '</td>' +
          '<td>' + statusBadge(plugin) + '</td>' +
          '<td class="text-nowrap">' +
          actionsHtml +
          '</td>'
        );
      }

      async function loadPlugins() {
        const response = await fetch("/plugins");
        const plugins = await response.json();

        tableBody.innerHTML = "";

        for (const plugin of plugins) {
          const row = document.createElement("tr");
          row.innerHTML = rowHtml(plugin);
          tableBody.appendChild(row);
        }

        const actionButtons = document.querySelectorAll("button[data-action][data-plugin-id]");
        for (const button of actionButtons) {
          button.addEventListener("click", () => {
            const pluginId = button.getAttribute("data-plugin-id");
            const action = button.getAttribute("data-action");

            if (action === "scan") {
              performScan(pluginId, button);
            }

            if (action === "stop") {
              performStop(pluginId, button);
            }

            if (action === "start") {
              performStart(pluginId, button);
            }
          });
        }
      }

      loadPlugins();
    </script>
  </body>
</html>`;

export class AdminRoute extends Route {
  url = "/admin";
  schema = undefined;
  handler = async (request: any, response: any) => {
    response.type("text/html").send(adminPage);
  };
}
