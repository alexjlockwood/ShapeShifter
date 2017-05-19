// TODO: figure out how to typecheck this...

export function mix(superclass) {
  return new MixinBuilder(superclass);
}

class MixinBuilder {
  constructor(private readonly superclass) { }

  with(mixins) {
    return mixins.reduce((c, mixin) => mixin(c), this.superclass);
  }
}
