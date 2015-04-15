sample clone
==========

Usage | Synopsis
------|-------
General | `$ appbuilder sample clone <Clone ID> [--path <Directory>]`	

Clones the selected sample app from GitHub to your local file system and preserves its existing project configuration. <% if(isHtml) { %>You can examine and modify the sample code, run it in the simulator, and build and deploy it on your devices. To list all available sample apps with their clone commands, run `$ appbuilder sample` 

If you want to develop for Windows Phone, make sure to manually set new unique values for the WP8ProductID and WP8PublisherID properties
to avoid issues when running your app on device. For more information about how to configure your project properties,
see [appbuilder prop](../configuration/prop.html)<% } %>

<% if(isConsole) { %>
WARNING: Always run this command in an empty directory or specify `--path` to an empty directory.
<% } %> 
### Options
* `--path` - Specifies the directory where you want to clone the sample app, if different from the current directory. The directory must be empty. 

### Attributes
* `<Clone ID>` is the title of the sample app as listed by `$ appbuilder sample`<% if(isHtml) { %>. If the title consists of two or more strings,    separated by a space, you must replace the spaces with hyphens. For example, to clone the Pinch and zoom sample app, run `$ appbuilder sample clone pinch-and-zoom`.

### Command Limitations
 
* You must run this command in an empty directory or specify `--path` to an empty directory. 

### Related Commands

Command | Description
----------|----------
[cloud](cloud.html) | Lists all projects associated with your Telerik Platform account.
[cloud export](cloud-export.html) | Exports one of your projects from the cloud and initializes it for development in the current directory.
[create](create.html) | Creates a project for hybrid or native development.
[create hybrid](create-hybrid.html) | Creates a new project from an Apache Cordova-based template.
[create native](create-native.html) | Creates a new project from a NativeScript-based template.
[create website](create-website.html) | Creates a new project from a Mobile Website-based template.
[init](init.html) | Initializes an existing project for development.
[init hybrid](init-hybrid.html) | Initializes an existing Apache Cordova project for development in the current directory.
[init native](init-native.html) | Initializes an existing NativeScript project for development in the current directory.
[init website](init-website.html) | Initializes an existing Mobile Website project for development in the current directory.
[sample](sample.html) | Lists all available sample apps with name, description, GitHub repository, and clone command.
<% } %>