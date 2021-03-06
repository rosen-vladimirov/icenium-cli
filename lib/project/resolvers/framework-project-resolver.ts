import * as frameworkProjectResolverBaseLib from "./framework-project-resolver-base";

export class FrameworkProjectResolver extends frameworkProjectResolverBaseLib.FrameworkProjectResolverBase implements Project.IFrameworkProjectResolver {
	constructor($errors: IErrors,
		$injector: IInjector) {
		super($errors, $injector);
	}

	public resolve(framework: string): Project.IFrameworkProject {
		return this.resolveByName<Project.IFrameworkProject>("Project", framework);
	}
}
$injector.register("frameworkProjectResolver", FrameworkProjectResolver);
